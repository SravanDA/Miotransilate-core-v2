package com.miotranslate.modules.search.service;

import com.miotranslate.modules.search.model.Bookmark;
import com.miotranslate.modules.search.model.RecentlyEditedEvent;
import com.miotranslate.modules.search.repository.BookmarkRepository;
import com.miotranslate.modules.search.repository.RecentlyEditedEventRepository;
import org.springframework.stereotype.Service;

import java.time.OffsetDateTime;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class SearchService {

    private final BookmarkRepository bookmarkRepository;
    private final RecentlyEditedEventRepository recentlyEditedEventRepository;

    public SearchService(BookmarkRepository bookmarkRepository, RecentlyEditedEventRepository recentlyEditedEventRepository) {
        this.bookmarkRepository = bookmarkRepository;
        this.recentlyEditedEventRepository = recentlyEditedEventRepository;
    }

    public List<Map<String, Object>> globalSearch(String query) {
        // Mocking the full-text search behavior
        // In real life, this would execute a PostgreSQL tsvector query:
        // SELECT * FROM tags WHERE to_tsvector('english', tag_id || ' ' || text) @@ plainto_tsquery('english', :query)
        Map<String, Object> result = new HashMap<>();
        result.put("matchType", "TAG_ID");
        result.put("targetId", "tag_matching_" + query);
        result.put("snippet", "Mock search result containing " + query);
        return Collections.singletonList(result);
    }

    public Bookmark saveBookmark(UUID userId, String targetId, String targetType) {
        Bookmark bookmark = new Bookmark();
        bookmark.setUserId(userId);
        bookmark.setTargetId(targetId);
        bookmark.setTargetType(targetType);
        bookmark.setCreatedAt(OffsetDateTime.now());
        return bookmarkRepository.save(bookmark);
    }

    public List<Bookmark> getBookmarks(UUID userId) {
        return bookmarkRepository.findAll().stream()
                .filter(b -> b.getUserId().equals(userId))
                .toList();
    }

    public void removeBookmark(UUID bookmarkId) {
        bookmarkRepository.deleteById(bookmarkId);
    }

    public List<RecentlyEditedEvent> getRecentlyEdited(UUID userId) {
        return recentlyEditedEventRepository.findAll().stream()
                .filter(e -> e.getUserId().equals(userId))
                .toList();
    }
}
