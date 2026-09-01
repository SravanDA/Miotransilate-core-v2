package com.miotranslate.modules.search.api;

import com.miotranslate.modules.search.model.Bookmark;
import com.miotranslate.modules.search.model.RecentlyEditedEvent;
import com.miotranslate.modules.search.service.SearchService;
import com.miotranslate.shared.auth.RequiresPermission;
import com.miotranslate.shared.auth.SecurityUtils;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/v1")
@RequiresPermission("CONTENT_VIEW")
public class SearchController {

    private final SearchService searchService;

    public SearchController(SearchService searchService) {
        this.searchService = searchService;
    }

    @GetMapping("/search")
    public ResponseEntity<List<Map<String, Object>>> globalSearch(@RequestParam("q") String query) {
        return ResponseEntity.ok(searchService.globalSearch(query));
    }

    @PostMapping("/bookmarks")
    public ResponseEntity<Bookmark> saveBookmark(@RequestBody Map<String, String> payload) {
        UUID userId = SecurityUtils.getCurrentUserId();
        String targetId = payload.get("targetId");
        String targetType = payload.get("targetType");
        return ResponseEntity.ok(searchService.saveBookmark(userId, targetId, targetType));
    }

    @GetMapping("/bookmarks")
    public ResponseEntity<List<Bookmark>> getBookmarks() {
        UUID userId = SecurityUtils.getCurrentUserId();
        return ResponseEntity.ok(searchService.getBookmarks(userId));
    }

    @DeleteMapping("/bookmarks/{id}")
    public ResponseEntity<Void> removeBookmark(@PathVariable UUID id) {
        searchService.removeBookmark(id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/recently-edited")
    public ResponseEntity<List<RecentlyEditedEvent>> getRecentlyEdited() {
        UUID userId = SecurityUtils.getCurrentUserId();
        return ResponseEntity.ok(searchService.getRecentlyEdited(userId));
    }
}
