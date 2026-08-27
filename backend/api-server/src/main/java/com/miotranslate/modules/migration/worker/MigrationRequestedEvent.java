package com.miotranslate.modules.migration.worker;

import lombok.Getter;
import org.springframework.context.ApplicationEvent;

import java.util.UUID;

@Getter
public class MigrationRequestedEvent extends ApplicationEvent {
    
    private final UUID importEventId;
    
    public MigrationRequestedEvent(Object source, UUID importEventId) {
        super(source);
        this.importEventId = importEventId;
    }
}
