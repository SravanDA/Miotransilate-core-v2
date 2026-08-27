# Multilingual Bulk Import Pages API

**Endpoint**: `/multilingual/bulkImportPages`  
**Method**: `POST`  
**Content-Type**: `application/json`

## Overview
The `bulkImportPages` API is designed to bulk import, insert, or update translated tag strings for a specific page across multiple languages simultaneously. It is highly optimized for updating a large number of key-value pairs (tags) for various languages in a single HTTP request.

## Supported Features
- **Single Page Scope**: The API is designed to update tags for exactly **one `pageId` per request**. All tags in the payload are associated with this single page.
- **Multi-language Aggregation**: Instead of making separate API calls for English, Hindi, Arabic, etc., you can send all language translations for a tag in a single block. The system automatically separates and processes them.
- **Smart Upsert (Merge)**: If a language's page record already exists, the API will *merge* the new tags with the existing tags, updating only the provided keys. If it doesn't exist, it creates a new record.
- **Partial Execution**: Languages are processed independently. If an invalid language code is passed (e.g., a language not configured by the admin), it fails gracefully for that specific language but continues to process the valid ones.
- **Dynamic Tag Restructuring**: The API reshapes the incoming `tagName` and `values` format into internal Map structures optimized for OrientDB storage.

---

## Request Payload

### Parameters
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `domain` | String | Yes | The tenant or business domain (e.g., `miosalon`). |
| `pageId` | String | Yes | The unique identifier for the page/screen (e.g., `PREPAID_SETTING`). |
| `pageName` | String | No | The human-readable name of the page. |
| `tags` | Array | Yes | An array of tag objects containing the key and its language translations. |

### Tag Object Structure
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `tagName` | String | Yes | The unique key/ID for the text element on the UI. |
| `values` | Object | Yes | A dictionary mapping language codes (e.g., `eng`, `hindi`) to their translated string values. |

### Payload Structure & Rules
- Each element inside the `tags` array represents one UI key (`tagName`).
- Inside each tag's `values` object, language codes (e.g., `eng`, `hindi`, `arabic`, `tamil`, `spanish`) map directly to translated strings.
- Keys can include standard UI labels, buttons, dynamic placeholders (e.g., `{0}`, `{1}`), validation errors, and confirmation dialogs.
- Different tags can have different sets of languages (asymmetric / sparse translations are fully supported).

---

## Request Payload Examples

### Example 1: Minimal Request (2 Tags, 2 Languages)
A simple payload for adding basic settings tags in English and Hindi.

```json
{
  "domain": "miosalon",
  "pageId": "PREPAID_SETTING",
  "pageName": "Prepaid Setting",
  "tags": [
    {
      "tagName": "prepaid_name",
      "values": {
        "eng": "Prepaid Name",
        "hindi": "प्रीपेड नाम"
      }
    },
    {
      "tagName": "prepaid_value",
      "values": {
        "eng": "Prepaid Value",
        "hindi": "प्रीपेड मूल्य"
      }
    }
  ]
}
```

---

### Example 2: Comprehensive Multi-Tag Request across 5 Languages (Full UI Module)
A complete real-world payload for an entire module screen (e.g., Expense Management) featuring multiple UI key categories:
- Headers & Titles
- Action Buttons
- Form Field Labels & Placeholders
- Table Column Headers
- Status Badges & Chips
- Toast / Validation Messages
- Modal Confirmation Dialogs

Languages covered: English (`eng`), Hindi (`hindi`), Arabic (`arabic`), Tamil (`tamil`), and Spanish (`spanish`).

```json
{
  "domain": "miosalon",
  "pageId": "EXPENSE_MANAGEMENT",
  "pageName": "Expense Management",
  "tags": [
    {
      "tagName": "page_title",
      "values": {
        "eng": "Expense Management",
        "hindi": "व्यय प्रबंधन",
        "arabic": "إدارة المصروفات",
        "tamil": "செலவு மேலாண்மை",
        "spanish": "Gestión de Gastos"
      }
    },
    {
      "tagName": "btn_add_expense",
      "values": {
        "eng": "Add Expense",
        "hindi": "व्यय जोड़ें",
        "arabic": "إضافة مصروف",
        "tamil": "செலவைச் சேர்க்கவும்",
        "spanish": "Agregar Gasto"
      }
    },
    {
      "tagName": "btn_export_csv",
      "values": {
        "eng": "Export CSV",
        "hindi": "सीएसवी निर्यात करें",
        "arabic": "تصدير CSV",
        "tamil": "CSV ஏற்றுமதி செய்",
        "spanish": "Exportar CSV"
      }
    },
    {
      "tagName": "lbl_expense_category",
      "values": {
        "eng": "Expense Category",
        "hindi": "व्यय श्रेणी",
        "arabic": "فئة المصروف",
        "tamil": "செலவு வகை",
        "spanish": "Categoría de Gasto"
      }
    },
    {
      "tagName": "placeholder_search_expense",
      "values": {
        "eng": "Search by vendor, reference #...",
        "hindi": "विक्रेता, संदर्भ संख्या द्वारा खोजें...",
        "arabic": "البحث حسب المورد أو الرقم المرجعي...",
        "tamil": "விற்பனையாளர், குறிப்பு எண் மூலம் தேடவும்...",
        "spanish": "Buscar por proveedor, referencia..."
      }
    },
    {
      "tagName": "col_header_payment_mode",
      "values": {
        "eng": "Payment Mode",
        "hindi": "भुगतान का प्रकार",
        "arabic": "طريقة الدفع",
        "tamil": "பணம் செலுத்தும் முறை",
        "spanish": "Modo de Pago"
      }
    },
    {
      "tagName": "status_approved",
      "values": {
        "eng": "Approved",
        "hindi": "स्वीकृत",
        "arabic": "معتمد",
        "tamil": "அங்கீகரிக்கப்பட்டது",
        "spanish": "Aprobado"
      }
    },
    {
      "tagName": "status_pending_approval",
      "values": {
        "eng": "Pending Approval",
        "hindi": "स्वीकृति लंबित",
        "arabic": "قيد الاعتماد",
        "tamil": "அங்கீகாரத்திற்கு நிலுவையில் உள்ளது",
        "spanish": "Pendiente de Aprobación"
      }
    },
    {
      "tagName": "val_err_amount_required",
      "values": {
        "eng": "Expense amount is required.",
        "hindi": "व्यय राशि अनिवार्य है।",
        "arabic": "مبلغ المصروف مطلوب.",
        "tamil": "செலவுத் தொகை தேவை.",
        "spanish": "El monto del gasto es obligatorio."
      }
    },
    {
      "tagName": "modal_confirm_delete_title",
      "values": {
        "eng": "Delete Expense Record?",
        "hindi": "क्या आप व्यय रिकॉर्ड हटाना चाहते हैं?",
        "arabic": "هل تريد حذف سجل المصروف؟",
        "tamil": "செலவு பதிவை நீக்கவா?",
        "spanish": "¿Eliminar registro de gasto?"
      }
    }
  ]
}
```

---

### Example 3: Dynamic Parameterized & Formatted Strings (`{0}`, `{1}`)
Payload demonstrating strings with dynamic variables, counts, currency symbols, and dates across multiple languages.

```json
{
  "domain": "miosalon",
  "pageId": "APPOINTMENT_CHECKOUT",
  "pageName": "Appointment Checkout",
  "tags": [
    {
      "tagName": "msg_booking_confirmed",
      "values": {
        "eng": "Appointment for {0} confirmed on {1} at {2}.",
        "hindi": "{0} के लिए अपॉइंटमेंट {1} को {2} बजे कन्फर्म हो गया है।",
        "arabic": "تم تأكيد الموعد لـ {0} في {1} الساعة {2}.",
        "tamil": "{0} க்கான முன்பதிவு {1} அன்று {2} மணிக்கு உறுதிசெய்யப்பட்டது.",
        "spanish": "Cita para {0} confirmada el {1} a las {2}."
      }
    },
    {
      "tagName": "lbl_total_services_count",
      "values": {
        "eng": "Total {0} services selected",
        "hindi": "कुल {0} सेवाएं चयनित",
        "arabic": "تم تحديد {0} خدمات إجمالاً",
        "tamil": "மொத்தம் {0} சேவைகள் தேர்ந்தெடுக்கப்பட்டன",
        "spanish": "Total de {0} servicios seleccionados"
      }
    },
    {
      "tagName": "lbl_discount_applied",
      "values": {
        "eng": "{0}% discount applied (-{1})",
        "hindi": "{0}% छूट लागू की गई (-{1})",
        "arabic": "تم تطبيق خصم {0}٪ (-{1})",
        "tamil": "{0}% தள்ளுபடி பயன்படுத்தப்பட்டது (-{1})",
        "spanish": "{0}% de descuento aplicado (-{1})"
      }
    }
  ]
}
```

---

### Example 4: Asymmetric / Sparse Translations (Different Language Sets per Tag)
The API does not require all tags to have the exact same list of languages. If a newly introduced tag only has English and Arabic translations, while other tags have English, Hindi, Arabic, and Tamil, the API safely processes and groups them into their respective language tables.

```json
{
  "domain": "miosalon",
  "pageId": "CUSTOMER_FEEDBACK",
  "pageName": "Customer Feedback",
  "tags": [
    {
      "tagName": "feedback_header",
      "values": {
        "eng": "How was your experience?",
        "hindi": "आपका अनुभव कैसा रहा?",
        "arabic": "كيف كانت تجربتك؟",
        "tamil": "உங்கள் அனுபவம் எப்படி இருந்தது?"
      }
    },
    {
      "tagName": "opt_star_rating_prompt",
      "values": {
        "eng": "Rate your service provider (1-5 stars)",
        "hindi": "अपने सेवा प्रदाता को रेटिंग दें (1-5 सितारे)",
        "arabic": "قيّم مقدم الخدمة (1-5 نجوم)"
      }
    },
    {
      "tagName": "btn_skip_feedback",
      "values": {
        "eng": "Skip for now",
        "arabic": "تخطي الآن"
      }
    },
    {
      "tagName": "lbl_net_promoter_score",
      "values": {
        "eng": "How likely are you to recommend us to a friend?",
        "hindi": "आप किसी मित्र को हमारी अनुशंसा करने की कितनी संभावना रखते हैं?"
      }
    }
  ]
}
```

---

### Example 5: Incremental Upsert / Tag Patching (Smart Merge)
When updating an existing page, you only need to send the tags you want to add or modify. All pre-existing tags in the database for `eng`, `hindi`, etc., are preserved.

```json
{
  "domain": "miosalon",
  "pageId": "PREPAID_SETTING",
  "pageName": "Prepaid Setting",
  "tags": [
    {
      "tagName": "prepaid_expiry_days",
      "values": {
        "eng": "Expiry (in Days)",
        "hindi": "समाप्ति (दिनों में)",
        "arabic": "تاريخ الانتهاء (بالأيام)",
        "tamil": "காலாவதி (நாட்களில்)"
      }
    },
    {
      "tagName": "prepaid_allow_refund",
      "values": {
        "eng": "Allow Balance Refund",
        "hindi": "शेष राशि वापसी की अनुमति दें",
        "arabic": "السماح باسترداد الرصيد",
        "tamil": "மீதத் தொகையைத் திரும்பப் பெற அனுமதிக்கவும்"
      }
    },
    {
      "tagName": "prepaid_name",
      "values": {
        "eng": "Prepaid Card Name",
        "hindi": "प्रीपेड कार्ड का नाम"
      }
    }
  ]
}
```
*Note: In this example, `prepaid_expiry_days` and `prepaid_allow_refund` will be added to existing records, and `prepaid_name` will be updated with new text, while older keys like `prepaid_value` will remain intact in the database.*

---

## Error States and Responses 

The AI orchestrates these error states dynamically. Failures are handled at two levels: **Global Request Validation** (which stops the entire request) and **Language-Level Validation** (which only fails the specific language).

### 1. Global Error: Invalid Domain
If the provided `domain` does not match the permitted domain (e.g., passing a domain other than `miosalon`), the entire request is rejected before any processing begins.

**Response:**
```json
{
    "status": "error",
    "reason": "Invalid domain. Only 'miosalon' is permitted."
}
```

### 2. Language-Level Error: Language Not Found
If one of the language codes provided in the `values` block (e.g., `french`) is not actively configured in the database, the API will fail for that specific language but **will continue** processing other valid languages.

**Response (Partial Failure within the `details` array):**
```json
{
    "pageId": "PREPAID_SETTING",
    "processed": 1,
    "failed": 1,
    "details": [
        {
            "language": "french",
            "status": "failed",
            "reason": "Language 'french' not found. Contact admin to create this language."
        },
        {
            "language": "eng",
            "status": "success"
        }
    ]
}
```

### 3. Language-Level Error: General Processing Exception
If an unexpected internal error or exception occurs while attempting to save a specific language's translations to the database (e.g., a database timeout or a corrupted payload field specific to that language), it is caught gracefully.

**Response (Exception Failure within the `details` array):**
```json
{
    "pageId": "PREPAID_SETTING",
    "processed": 1,
    "failed": 1,
    "details": [
        {
            "language": "hindi",
            "status": "failed",
            "reason": "An error occurred while processing language 'hindi'."
        },
        {
            "language": "eng",
            "status": "success"
        }
    ]
}
```

---

## Success Responses

If all languages provided are valid and processed successfully without errors, the response returns the count and per-language statuses:

### Example Success Response (2 Languages)
```json
{
    "pageId": "PREPAID_SETTING",
    "processed": 2,
    "failed": 0,
    "details": [
        {
            "language": "eng",
            "status": "success"
        },
        {
            "language": "hindi",
            "status": "success"
        }
    ]
}
```

### Example Success Response (5 Languages - from Example 2)
```json
{
    "pageId": "EXPENSE_MANAGEMENT",
    "processed": 5,
    "failed": 0,
    "details": [
        {
            "language": "eng",
            "status": "success"
        },
        {
            "language": "hindi",
            "status": "success"
        },
        {
            "language": "arabic",
            "status": "success"
        },
        {
            "language": "tamil",
            "status": "success"
        },
        {
            "language": "spanish",
            "status": "success"
        }
    ]
}
```
