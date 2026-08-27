package com.miotranslate.shared.integration.publishing;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class PushResult {
    private boolean success;
    private String responsePayload;
    private int httpStatusCode;
}
