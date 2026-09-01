package com.miotranslate.modules.registry.api;

import com.miotranslate.modules.registry.model.Page;
import com.miotranslate.modules.registry.model.Tag;
import com.miotranslate.modules.registry.service.RegistryService;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import com.miotranslate.shared.auth.RequiresPermission;
import com.miotranslate.shared.auth.SecurityUtils;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/v1")
@RequiresPermission("CONTENT_VIEW")
public class RegistryController {

    private final RegistryService registryService;

    public RegistryController(RegistryService registryService) {
        this.registryService = registryService;
    }

    @PostMapping("/pages")
    @RequiresPermission("PAGE_TAG_CREATE")
    public ResponseEntity<Page> createPage(@RequestBody Page page) {
        page.setCreatedBy(SecurityUtils.getCurrentUserId());
        Page created = registryService.createPage(page);
        return ResponseEntity.ok().eTag(String.valueOf(created.getEtagVersion())).body(created);
    }

    @GetMapping("/pages")
    public ResponseEntity<List<Page>> getPages() {
        return ResponseEntity.ok(registryService.getPages());
    }

    @GetMapping("/pages/{pageId}")
    public ResponseEntity<Page> getPage(@PathVariable String pageId) {
        return ResponseEntity.ok(registryService.getPage(pageId));
    }

    @GetMapping("/pages/{pageId}/detail")
    public ResponseEntity<java.util.Map<String, Object>> getPageDetail(@PathVariable String pageId) {
        return ResponseEntity.ok(registryService.getPageDetailAggregated(pageId));
    }

    @PatchMapping("/pages/{pageId}")
    @RequiresPermission("PAGE_TAG_CREATE")
    public ResponseEntity<Page> updatePage(
            @PathVariable String pageId,
            @RequestHeader(value = HttpHeaders.IF_MATCH, required = false) String ifMatch,
            @RequestBody Page updatePayload) {
        Page updated = registryService.updatePage(pageId, ifMatch, updatePayload.getPageName(), updatePayload.getModule());
        return ResponseEntity.ok().eTag(String.valueOf(updated.getEtagVersion())).body(updated);
    }

    @PostMapping("/pages/{pageId}/tags")
    @RequiresPermission("PAGE_TAG_CREATE")
    public ResponseEntity<Tag> createTag(@PathVariable String pageId, @RequestBody Tag tag) {
        tag.setPageId(pageId);
        tag.setCreatedBy(SecurityUtils.getCurrentUserId());
        Tag created = registryService.createTag(tag, tag.getCreatedBy());
        return ResponseEntity.ok().eTag(String.valueOf(created.getEtagVersion())).body(created);
    }

    @GetMapping("/pages/{pageId}/tags")
    public ResponseEntity<List<Tag>> getTags(@PathVariable String pageId) {
        return ResponseEntity.ok(registryService.getTagsForPage(pageId));
    }

    @GetMapping("/tags/{tagId}")
    public ResponseEntity<Tag> getTagDetail(@PathVariable String tagId) {
        return ResponseEntity.ok(registryService.getTag(tagId));
    }

    @PostMapping("/tags/{tagId}/deprecate")
    @RequiresPermission("PAGE_TAG_CREATE")
    public ResponseEntity<Tag> deprecateTag(@PathVariable String tagId) {
        Tag deprecated = registryService.deprecateTag(tagId);
        return ResponseEntity.ok().eTag(String.valueOf(deprecated.getEtagVersion())).body(deprecated);
    }

    @PatchMapping("/tags/{tagId}")
    @RequiresPermission("PAGE_TAG_CREATE")
    public ResponseEntity<Tag> updateTag(
            @PathVariable String tagId,
            @RequestHeader(value = HttpHeaders.IF_MATCH, required = false) String ifMatch,
            @RequestBody Tag updatePayload) {
            
        Tag updated = registryService.updateTag(tagId, ifMatch, updatePayload.getCopyType());
        return ResponseEntity.ok().eTag(String.valueOf(updated.getEtagVersion())).body(updated);
    }
}
