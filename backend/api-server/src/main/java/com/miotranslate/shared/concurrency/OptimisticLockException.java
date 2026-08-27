package com.miotranslate.shared.concurrency;

public class OptimisticLockException extends RuntimeException {
    
    private final String entityType;
    private final String entityId;
    
    public OptimisticLockException(String entityType, String entityId, String message) {
        super(message);
        this.entityType = entityType;
        this.entityId = entityId;
    }
    
    public String getEntityType() {
        return entityType;
    }
    
    public String getEntityId() {
        return entityId;
    }
}
