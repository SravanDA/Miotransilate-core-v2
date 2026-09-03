package com.miotranslate.modules.registry.service;

import com.miotranslate.modules.registry.model.Page;
import com.miotranslate.modules.registry.model.Tag;
import com.miotranslate.modules.content.service.ContentService;
import com.miotranslate.modules.registry.repository.PageRepository;
import com.miotranslate.modules.registry.repository.TagRepository;
import com.miotranslate.shared.audit.AuditService;
import com.miotranslate.shared.concurrency.ConcurrencyUtils;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;

@Service
public class RegistryService {

    private final PageRepository pageRepository;
    private final TagRepository tagRepository;
    private final AuditService auditService;
    private final ContentService contentService;
    private final JdbcTemplate jdbcTemplate;

    public RegistryService(PageRepository pageRepository, TagRepository tagRepository, AuditService auditService, ContentService contentService, JdbcTemplate jdbcTemplate) {
        this.pageRepository = pageRepository;
        this.tagRepository = tagRepository;
        this.auditService = auditService;
        this.contentService = contentService;
        this.jdbcTemplate = jdbcTemplate;
    }

    @Transactional(isolation = Isolation.READ_COMMITTED)
    public Page createPage(Page page) {
        Page savedPage = pageRepository.save(page);
        auditService.record("PAGE_CREATED", "PAGE", savedPage.getPageId(), "Created page " + savedPage.getPageName());
        return savedPage;
    }

    @Transactional(isolation = Isolation.SERIALIZABLE)
    public Tag createTag(Tag tag, UUID userId) {
        // Validation of Page existence could go here
        
        Tag savedTag = tagRepository.save(tag);
        
        // Initialize NO_COPY English Copy
        contentService.initializeEnglishCopy(savedTag.getTagId());
        
        auditService.record("TAG_CREATED", "TAG", savedTag.getTagId(), "Created tag on page " + savedTag.getPageId());
        return savedTag;
    }

    @Transactional(isolation = Isolation.READ_COMMITTED)
    public Tag updateTag(String tagId, String ifMatchETag, String copyType) {
        Tag tag = tagRepository.findByIdForUpdate(tagId)
                .orElseThrow(() -> new IllegalArgumentException("Tag not found"));
        
        ConcurrencyUtils.validateETag(ifMatchETag, tag.getEtagVersion(), "TAG", tagId);
        
        tag.setCopyType(copyType);
        tag.setEtagVersion(tag.getEtagVersion() + 1);
        
        Tag updatedTag = tagRepository.save(tag);
        auditService.record("TAG_UPDATED", "TAG", tagId, "Updated copyType to " + copyType);
        
        return updatedTag;
    }

    @Transactional(readOnly = true)
    public List<Page> getPages() {
        return pageRepository.findAll(); // Should be paginated in production
    }

    @Transactional(readOnly = true)
    public Page getPage(String pageId) {
        return pageRepository.findById(pageId).orElseThrow(() -> new IllegalArgumentException("Page not found"));
    }

    @Transactional(isolation = Isolation.READ_COMMITTED)
    public Page updatePage(String pageId, String ifMatchETag, String pageName, String module) {
        Page page = pageRepository.findByIdForUpdate(pageId)
                .orElseThrow(() -> new IllegalArgumentException("Page not found"));
        
        ConcurrencyUtils.validateETag(ifMatchETag, page.getEtagVersion(), "PAGE", pageId);
        
        if (pageName != null) page.setPageName(pageName);
        if (module != null) page.setModule(module);
        page.setEtagVersion(page.getEtagVersion() + 1);
        
        Page updated = pageRepository.save(page);
        auditService.record("PAGE_UPDATED", "PAGE", pageId, "Updated page metadata");
        return updated;
    }

    @Transactional(readOnly = true)
    public List<Tag> getTagsForPage(String pageId) {
        return tagRepository.findByPageId(pageId);
    }

    @Transactional(readOnly = true)
    public Tag getTag(String tagId) {
        return tagRepository.findById(tagId).orElseThrow(() -> new IllegalArgumentException("Tag not found"));
    }

    @Transactional(isolation = Isolation.READ_COMMITTED)
    public Tag deprecateTag(String tagId) {
        Tag tag = tagRepository.findByIdForUpdate(tagId)
                .orElseThrow(() -> new IllegalArgumentException("Tag not found"));
        
        tag.setStatus("DEPRECATED");
        tag.setEtagVersion(tag.getEtagVersion() + 1);
        Tag saved = tagRepository.save(tag);
        
        auditService.record("TAG_DEPRECATED", "TAG", tagId, "Deprecated tag");
        
        // As per API-0107: evaluate page cascade
        List<Tag> pageTags = getTagsForPage(tag.getPageId());
        boolean allDeprecated = pageTags.stream().allMatch(t -> "DEPRECATED".equals(t.getStatus()));
        if (allDeprecated && !pageTags.isEmpty()) {
            Page page = pageRepository.findByIdForUpdate(tag.getPageId()).orElseThrow();
            page.setStatus("DEPRECATED");
            page.setEtagVersion(page.getEtagVersion() + 1);
            pageRepository.save(page);
            auditService.record("PAGE_DEPRECATED", "PAGE", page.getPageId(), "Auto-deprecated due to all tags deprecated");
        }
        
        return saved;
    }

    @Transactional(readOnly = true)
    public java.util.Map<String, Object> getPageDetailAggregated(String pageId) {
        Page page = getPage(pageId);
        List<Tag> tags = getTagsForPage(pageId);
        
        String ecSql = "SELECT ec.tag_id, ec.status, ec.current_version_number, v.text " +
                       "FROM content.english_copies ec " +
                       "LEFT JOIN content.english_copy_versions v ON ec.tag_id = v.tag_id " +
                       "  AND COALESCE(ec.current_version_number, (SELECT MAX(v2.version_number) FROM content.english_copy_versions v2 WHERE v2.tag_id = ec.tag_id)) = v.version_number " +
                       "WHERE ec.tag_id IN (SELECT tag_id FROM registry.tags WHERE page_id = ?)";
        
        java.util.Map<String, java.util.Map<String, Object>> ecMap = new java.util.HashMap<>();
        jdbcTemplate.query(ecSql, rs -> {
            java.util.Map<String, Object> ec = new java.util.HashMap<>();
            ec.put("status", rs.getString("status"));
            ec.put("currentVersion", rs.getInt("current_version_number"));
            ec.put("text", rs.getString("text"));
            ecMap.put(rs.getString("tag_id"), ec);
        }, pageId);
        
        String transSql = "SELECT t.tag_id, t.language_code, t.status, v.text, v.confidence_score, v.source_english_version, t.updated_at " +
                          "FROM translation.translations t " +
                          "LEFT JOIN translation.translation_versions v ON t.tag_id = v.tag_id AND t.language_code = v.language_code AND t.current_version_number = v.version_number " +
                          "WHERE t.tag_id IN (SELECT tag_id FROM registry.tags WHERE page_id = ?)";
                          
        java.util.Map<String, java.util.Map<String, java.util.Map<String, Object>>> transMap = new java.util.HashMap<>();
        jdbcTemplate.query(transSql, rs -> {
            String tagId = rs.getString("tag_id");
            String lang = rs.getString("language_code");
            transMap.putIfAbsent(tagId, new java.util.HashMap<>());
            
            java.util.Map<String, Object> tr = new java.util.HashMap<>();
            tr.put("status", rs.getString("status"));
            tr.put("text", rs.getString("text"));
            tr.put("confidence", rs.getBigDecimal("confidence_score"));
            tr.put("translatedAtEnglishVersion", rs.getInt("source_english_version"));
            tr.put("lastUpdated", rs.getTimestamp("updated_at") != null ? rs.getTimestamp("updated_at").toInstant().toString() : null);
            
            transMap.get(tagId).put(lang, tr);
        }, pageId);
        
        java.util.List<java.util.Map<String, Object>> tagsList = new java.util.ArrayList<>();
        for (Tag t : tags) {
            java.util.Map<String, Object> tagObj = new java.util.HashMap<>();
            tagObj.put("id", t.getTagId());
            tagObj.put("pageId", t.getPageId());
            tagObj.put("type", t.getCopyType() != null ? t.getCopyType() : "General");
            
            java.util.Map<String, Object> ec = ecMap.get(t.getTagId());
            if (ec != null) {
                tagObj.put("english", ec.get("text") != null ? ec.get("text") : "");
                tagObj.put("englishVersion", ec.get("currentVersion") != null ? ec.get("currentVersion") : 0);
                tagObj.put("englishStatus", ec.get("status") != null ? ec.get("status") : "NO_COPY");
            } else {
                tagObj.put("english", "");
                tagObj.put("englishVersion", 0);
                tagObj.put("englishStatus", "NO_COPY");
            }
            
            tagObj.put("values", transMap.getOrDefault(t.getTagId(), new java.util.HashMap<>()));
            tagObj.put("comments", new java.util.ArrayList<>());
            tagsList.add(tagObj);
        }
        
        java.util.Map<String, Object> result = new java.util.HashMap<>();
        result.put("page", page);
        result.put("tags", tagsList);
        
        return result;
    }

    @Transactional(isolation = Isolation.READ_COMMITTED)
    public java.util.Map<String, Object> batchImportTags(String pageId, List<java.util.Map<String, Object>> tags, UUID userId) {
        Page page = getPage(pageId);
        int importedCount = 0;
        
        for (java.util.Map<String, Object> t : tags) {
            String tagId = (String) t.get("id");
            if (tagId == null || tagId.trim().isEmpty()) {
                tagId = (String) t.get("tagId");
            }
            if (tagId == null || tagId.trim().isEmpty()) continue;
            tagId = tagId.trim();
            
            String copyType = (String) t.getOrDefault("type", "General");
            if (copyType == null || copyType.trim().isEmpty()) copyType = "General";
            
            String english = (String) t.getOrDefault("english", "");
            if (english == null) english = "";
            
            // 1. Insert or update tag in registry.tags immediately via JDBC
            int tagInserted = jdbcTemplate.update(
                "INSERT INTO registry.tags (tag_id, page_id, copy_type, status, created_by, etag_version, created_at, updated_at) " +
                "VALUES (?, ?, ?, 'ACTIVE', ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) " +
                "ON CONFLICT (tag_id) DO UPDATE SET " +
                "  page_id = CASE " +
                "    WHEN EXCLUDED.tag_id LIKE EXCLUDED.page_id || '_%' THEN EXCLUDED.page_id " +
                "    ELSE registry.tags.page_id " +
                "  END, " +
                "  copy_type = EXCLUDED.copy_type, " +
                "  updated_at = CURRENT_TIMESTAMP",
                tagId, pageId, copyType, userId
            );
            if (tagInserted > 0) {
                importedCount++;
            }
            
            // 2. Initialize or update English copy
            if (!english.trim().isEmpty()) {
                jdbcTemplate.update(
                    "INSERT INTO content.english_copies (tag_id, status, current_version_number, etag_version, created_at, updated_at) " +
                    "VALUES (?, 'APPROVED', 1, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) " +
                    "ON CONFLICT (tag_id) DO UPDATE SET status = 'APPROVED', current_version_number = 1, updated_at = CURRENT_TIMESTAMP",
                    tagId
                );
                jdbcTemplate.update(
                    "INSERT INTO content.english_copy_versions (tag_id, version_number, text, change_reason, status, authored_by, approved_by, approved_at, created_at) " +
                    "VALUES (?, 1, ?, 'Initial import', 'APPROVED', ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) " +
                    "ON CONFLICT (tag_id, version_number) DO UPDATE SET text = EXCLUDED.text, status = 'APPROVED'",
                    tagId, english.trim(), userId, userId
                );
            } else {
                jdbcTemplate.update(
                    "INSERT INTO content.english_copies (tag_id, status, etag_version, created_at, updated_at) " +
                    "VALUES (?, 'NO_COPY', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) " +
                    "ON CONFLICT (tag_id) DO NOTHING",
                    tagId
                );
            }
            
            // 3. Initial translations if provided
            Object valuesObj = t.get("values");
            if (valuesObj instanceof java.util.Map<?, ?> valuesMap) {
                for (java.util.Map.Entry<?, ?> entry : valuesMap.entrySet()) {
                    String langCode = String.valueOf(entry.getKey());
                    Object valDataObj = entry.getValue();
                    if (valDataObj instanceof java.util.Map<?, ?> valData) {
                        String transText = (String) valData.get("text");
                        if (transText != null && !transText.trim().isEmpty()) {
                            jdbcTemplate.update(
                                "INSERT INTO translation.translations (tag_id, language_code, status, current_version_number, etag_version, created_at, updated_at) " +
                                "VALUES (?, ?, 'APPROVED', 1, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) " +
                                "ON CONFLICT (tag_id, language_code) DO UPDATE SET status = 'APPROVED', current_version_number = 1, updated_at = CURRENT_TIMESTAMP",
                                tagId, langCode
                            );
                            jdbcTemplate.update(
                                "INSERT INTO translation.translation_versions (tag_id, language_code, version_number, text, creation_method, source_english_version, status, confidence_score, authored_by_source, created_at) " +
                                "VALUES (?, ?, 1, ?, 'MIGRATED', 1, 'APPROVED', 0.95, 'USER', CURRENT_TIMESTAMP) " +
                                "ON CONFLICT (tag_id, language_code, version_number) DO UPDATE SET text = EXCLUDED.text, status = 'APPROVED'",
                                tagId, langCode, transText.trim()
                            );
                        }
                    }
                }
            }
        }
        
        auditService.record("TAGS_BATCH_IMPORTED", "PAGE", pageId, "Batch imported " + importedCount + " tags for page " + page.getPageName());
        
        java.util.Map<String, Object> resMap = new java.util.HashMap<>();
        resMap.put("pageId", pageId);
        resMap.put("importedCount", importedCount);
        resMap.put("totalTagsSubmitted", tags.size());
        return resMap;
    }
}
