package com.miotranslate.shared.job;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

@Component
public class NotificationDispatchWorker {
    private static final Logger log = LoggerFactory.getLogger(NotificationDispatchWorker.class);
    
    public void process(Object payload) {
        log.info("Running NOTIFICATION_DISPATCH for payload={}", payload);
        // Mocking the insert into system_ops.notifications
    }
}
