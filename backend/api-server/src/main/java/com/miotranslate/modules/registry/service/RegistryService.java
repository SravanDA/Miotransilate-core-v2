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
                       "LEFT JOIN content.english_copy_versions v ON ec.tag_id = v.tag_id AND ec.current_version_number = v.version_number " +
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
            java.util.Map<String, Object> trans = new java.util.HashMap<>();
            trans.put("status", rs.getString("status"));
            trans.put("text", rs.getString("text"));
            trans.put("confidence", rs.getDouble("confidence_score"));
            trans.put("translatedAtEnglishVersion", rs.getInt("source_english_version"));
            trans.put("lastUpdated", rs.getTimestamp("updated_at") != null ? rs.getTimestamp("updated_at").toInstant().toString() : null);
            transMap.get(tagId).put(lang, trans);
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
            } else {
                tagObj.put("english", "");
                tagObj.put("englishVersion", 0);
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
}
