package com.miotranslate.modules.translation.engine.model;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Map;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ValidationOutcome {
    // Map of tagId to its ValidationDetails
    private Map<String, ValidationDetails> details;
}
