package com.miotranslate.modules.translation.engine;

import com.miotranslate.modules.translation.engine.model.*;
import com.miotranslate.shared.integration.ai.model.ScreenTranslationResult;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Slf4j
@Component
public class Validator {

    private static final Set<String> VALID_RESOLVED_BY = Set.of(
            "siblings", "tag_id", "page", "domain", "unambiguous", "guessed"
    );

    private static final Set<String> VALID_RISK = Set.of(
            "low", "medium", "high"
    );

    private static final Set<String> UNTRANSLATED_ALLOWLIST = Set.of(
            "SMS", "POS", "Email", "WhatsApp", "MioSalon", "OK", "ID"
    );

    // Matches {{var}}, {var}, %1$s, %s, %d
    private static final Pattern PLACEHOLDER_PATTERN = Pattern.compile("(\\{\\{[^}]+\\}\\})|(\\{[^}]+\\})|(%\\d+\\$[a-zA-Z])|(%[a-zA-Z])");
    
    // Matches HTML tags, HTML entities, and newlines
    private static final Pattern MARKUP_PATTERN = Pattern.compile("(<[^>]+>)|(&[a-zA-Z]+;)|(\\n)|(\\r)");

    public PreValidationResult preValidate(TranslationChunk chunk) {
        List<String> skipList = new ArrayList<>();
        Map<String, List<String>> expectedPlaceholders = new HashMap<>();

        if (chunk.getTagsToTranslate() != null) {
            for (TagContext tagCtx : chunk.getTagsToTranslate()) {
                String text = tagCtx.getEnglishText();
                if (text == null || text.trim().isEmpty() || text.matches("^[0-9\\p{Punct}]+$")) {
                    skipList.add(tagCtx.getTagId());
                    continue;
                }
                expectedPlaceholders.put(tagCtx.getTagId(), extractMatches(text, PLACEHOLDER_PATTERN));
            }
        }
        return new PreValidationResult(skipList, expectedPlaceholders);
    }

    public ModelOutputValidation validateModelOutput(
            List<ScreenTranslationResult> results,
            Set<String> requestedTagIds
    ) {
        List<ScreenTranslationResult> valid = new ArrayList<>();
        Set<String> rejected = new HashSet<>();
        Set<String> seen = new HashSet<>();

        if (results != null) {
            for (ScreenTranslationResult result : results) {
                String tag = result.getTag();
                if (tag == null || !requestedTagIds.contains(tag)) {
                    log.warn("Unexpected tag in response: {}", tag);
                    continue;
                }
                if (!seen.add(tag)) {
                    log.warn("Duplicate tag in response: {}", tag);
                    continue;
                }
                if (result.getSense() == null || result.getSense().trim().isEmpty() ||
                        result.getTranslation() == null || result.getTranslation().trim().isEmpty()) {
                    rejected.add(tag);
                    continue;
                }
                if (!VALID_RESOLVED_BY.contains(result.getResolvedBy()) ||
                        !VALID_RISK.contains(result.getRisk())) {
                    rejected.add(tag);
                    continue;
                }
                valid.add(result);
            }
        }

        Set<String> missing = new HashSet<>(requestedTagIds);
        missing.removeAll(seen);
        
        return new ModelOutputValidation(valid, rejected, missing);
    }

    public ValidationOutcome postValidate(
            List<ScreenTranslationResult> results,
            TranslationChunk chunk,
            PreValidationResult preResult
    ) {
        Map<String, ValidationDetails> detailsMap = new HashMap<>();

        Map<String, TagContext> contextMap = new HashMap<>();
        if (chunk.getTagsToTranslate() != null) {
            for (TagContext ctx : chunk.getTagsToTranslate()) {
                contextMap.put(ctx.getTagId(), ctx);
            }
        }

        for (ScreenTranslationResult result : results) {
            String tagId = result.getTag();
            TagContext ctx = contextMap.get(tagId);
            if (ctx == null) continue; // Should have been caught by validateModelOutput

            String source = ctx.getEnglishText();
            String target = result.getTranslation();
            
            ValidationDetails details = new ValidationDetails();
            details.setTagId(tagId);
            details.setPassed(true);
            details.setSoftFlags(new ArrayList<>());
            
            // 5. Leading/trailing space auto-fix
            target = fixSpacing(source, target);
            if (!target.equals(result.getTranslation())) {
                details.setFixedTranslation(target);
            }

            // 1. Placeholder integrity check
            List<String> expectedPlaceholders = preResult.getExpectedPlaceholders().getOrDefault(tagId, new ArrayList<>());
            List<String> actualPlaceholders = extractMatches(target, PLACEHOLDER_PATTERN);
            if (!compareMultisets(expectedPlaceholders, actualPlaceholders)) {
                details.setPassed(false);
                details.setFailureReason("FAILED_PLACEHOLDER");
                detailsMap.put(tagId, details);
                continue; // Hard fail, skip other checks
            }

            // 4. Markup preservation check
            List<String> expectedMarkup = extractMatches(source, MARKUP_PATTERN);
            List<String> actualMarkup = extractMatches(target, MARKUP_PATTERN);
            if (!compareMultisets(expectedMarkup, actualMarkup)) {
                details.setPassed(false);
                details.setFailureReason("FAILED_MARKUP");
                detailsMap.put(tagId, details);
                continue; // Hard fail
            }

            // 2. Length ratio check
            if (source.length() > 0) {
                double ratio = (double) target.length() / source.length();
                if (ratio < 0.5 || ratio > 2.5) {
                    details.getSoftFlags().add("needs_attention_length");
                }
            }

            // 3. Untranslated copy check
            if (source.trim().equalsIgnoreCase(target.trim()) && !UNTRANSLATED_ALLOWLIST.contains(source.trim())) {
                details.getSoftFlags().add("needs_attention_untranslated");
            }

            detailsMap.put(tagId, details);
        }

        return new ValidationOutcome(detailsMap);
    }

    private List<String> extractMatches(String text, Pattern pattern) {
        List<String> matches = new ArrayList<>();
        if (text == null) return matches;
        Matcher matcher = pattern.matcher(text);
        while (matcher.find()) {
            matches.add(matcher.group());
        }
        return matches;
    }

    private boolean compareMultisets(List<String> a, List<String> b) {
        if (a.size() != b.size()) return false;
        List<String> copyB = new ArrayList<>(b);
        for (String item : a) {
            if (!copyB.remove(item)) return false;
        }
        return copyB.isEmpty();
    }

    private String fixSpacing(String source, String target) {
        if (source == null || target == null || source.isEmpty()) return target;
        
        boolean sourceStartsSpace = Character.isWhitespace(source.charAt(0));
        boolean sourceEndsSpace = Character.isWhitespace(source.charAt(source.length() - 1));
        
        String trimmedTarget = target.trim();
        if (trimmedTarget.isEmpty()) return target; // keep as is if it's all spaces
        
        StringBuilder fixed = new StringBuilder();
        if (sourceStartsSpace) fixed.append(" ");
        fixed.append(trimmedTarget);
        if (sourceEndsSpace) fixed.append(" ");
        
        return fixed.toString();
    }
}
