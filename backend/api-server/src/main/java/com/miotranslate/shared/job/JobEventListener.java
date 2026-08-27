package com.miotranslate.shared.job;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.ApplicationContext;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

import java.util.Map;

@Component
public class JobEventListener {

    private static final Logger log = LoggerFactory.getLogger(JobEventListener.class);
    private final ApplicationContext applicationContext;

    public JobEventListener(ApplicationContext applicationContext) {
        this.applicationContext = applicationContext;
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void handleAsyncJobEvent(JobDispatcher.AsyncJobEvent event) {
        log.info("Processing async job: {}", event.jobType());
        
        try {
            switch (event.jobType()) {
                case "STALE_CASCADE" -> getWorker(StaleCascadeWorker.class).process(event.payload());
                case "IMPLICIT_DEV_PUBLISH" -> getWorker(ImplicitDevPublishWorker.class).process(event.payload());
                case "COVERAGE_RECALC" -> getWorker(CoverageRecalcWorker.class).process(event.payload());
                case "NOTIFICATION_DISPATCH" -> getWorker(NotificationDispatchWorker.class).process(event.payload());
                case "EXPORT_GENERATION" -> getWorker(ExportGenerationWorker.class).process(event.payload());
                case "MIGRATION_EXECUTION" -> getWorker(MigrationExecutionWorker.class).process(event.payload());
                case "CREATE_TRANSLATION_SLOTS" -> getWorker(CreateTranslationSlotsWorker.class).process(event.payload());
                default -> log.warn("Unknown job type: {}", event.jobType());
            }
        } catch (Exception e) {
            log.error("Failed to process async job: {}", event.jobType(), e);
            // In a real outbox pattern, we would update retry_count in DB and rely on polling to retry
        }
    }

    private <T> T getWorker(Class<T> workerClass) {
        return applicationContext.getBean(workerClass);
    }
}
