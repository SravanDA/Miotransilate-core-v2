package com.miotranslate.shared.concurrency;

import org.springframework.util.StringUtils;

public final class ConcurrencyUtils {
    
    private ConcurrencyUtils() {}
    
    public static void validateETag(String expectedETag, Integer actualVersion, String entityType, String entityId) {
        if (!StringUtils.hasText(expectedETag)) {
            return; // If-Match header not provided, skip or fail depending on strictness
        }
        
        String cleanETag = expectedETag.replace("\"", "");
        try {
            int expectedVersion = Integer.parseInt(cleanETag);
            if (expectedVersion != actualVersion) {
                throw new OptimisticLockException(entityType, entityId, 
                    String.format("ETag mismatch for %s %s. Expected: %d, Actual: %d", entityType, entityId, expectedVersion, actualVersion));
            }
        } catch (NumberFormatException e) {
            throw new IllegalArgumentException("Invalid ETag format: " + expectedETag);
        }
    }
}
