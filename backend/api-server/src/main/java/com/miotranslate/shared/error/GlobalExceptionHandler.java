package com.miotranslate.shared.error;

import com.miotranslate.shared.concurrency.OptimisticLockException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.Map;

@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(OptimisticLockException.class)
    public ResponseEntity<?> handleOptimisticLockException(OptimisticLockException ex) {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(
            Map.of("error", Map.of(
                "code", "CONCURRENCY_CONFLICT",
                "message", ex.getMessage(),
                "details", Map.of("entityType", ex.getEntityType(), "entityId", ex.getEntityId())
            ))
        );
    }
    
    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<?> handleIllegalArgumentException(IllegalArgumentException ex) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(
            Map.of("error", Map.of(
                "code", "BAD_REQUEST",
                "message", ex.getMessage()
            ))
        );
    }

    // Additional generic handlers can be added here
}
