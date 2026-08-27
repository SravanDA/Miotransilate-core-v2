package com.miotranslate.modules.collaboration.worker;

import lombok.AllArgsConstructor;
import lombok.Getter;
import org.springframework.context.ApplicationEvent;

import java.util.UUID;

@Getter
public class ExportRequestedEvent extends ApplicationEvent {
    
    private final UUID exportJobId;
    
    public ExportRequestedEvent(Object source, UUID exportJobId) {
        super(source);
        this.exportJobId = exportJobId;
    }
}
