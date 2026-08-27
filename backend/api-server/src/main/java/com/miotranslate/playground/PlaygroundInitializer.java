package com.miotranslate.playground;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.annotation.Profile;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@Profile("mock")
@RequiredArgsConstructor
public class PlaygroundInitializer {

    private final CsvImporter csvImporter;

    @EventListener(ApplicationReadyEvent.class)
    public void onApplicationReady() {
        log.info("Playground mock profile active, starting data import...");
        csvImporter.importTags();
        log.info("Playground data initialization complete.");
    }
}
