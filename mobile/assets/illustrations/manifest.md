# Ảnh minh họa mobile

Ảnh tạo bằng AI trong ứng dụng đều được gắn nhãn “MINH HỌA”. Ảnh cơ sở và chuyên viên chỉ hiển thị khi API có ảnh thật; không dùng ảnh tạo để giả làm con người, cơ sở hoặc kết quả điều trị.

| File | Nội dung | Nguồn |
| --- | --- | --- |
| `hair-men.jpg` | Dụng cụ cắt tóc nam | Chuyển từ Preview; [PNG gốc](../../../docs/generated-images/beautybook/originals/hair-men-mobile.png) |
| `hair.webp` | Dụng cụ chăm sóc tóc | Chuyển từ Preview |
| `skin.webp` | Sản phẩm chăm sóc da và hero | Chuyển từ Preview |
| `nails.webp` | Dụng cụ chăm sóc móng | Chuyển từ Preview |
| `spa.webp` | Sản phẩm thư giãn | Chuyển từ Preview |
| `gel-polish.jpg` | Sơn gel và đèn UV | ImageGen tích hợp; [PNG gốc](../../../docs/generated-images/beautybook/originals/gel-polish.png) |
| `hair-removal.jpg` | Thiết bị triệt lông và kính bảo vệ | ImageGen tích hợp; [PNG gốc](../../../docs/generated-images/beautybook/originals/hair-removal.png) |

Hai ảnh mới được thu về 640×640 JPEG để dùng trên thẻ mobile. Mapping nằm ở `src/components/categoryArt.ts`.

Prompt cuối cho `gel-polish.jpg`: “Use case: photorealistic-natural. Asset type: square category illustration for the BeautyBook mobile app. Primary request: create a distinct, tasteful image for the Vietnamese 'Sơn gel' nail-polish category, to replace a blank category card. Scene/backdrop: warm ivory limestone tabletop and softly sunlit neutral spa setting, consistent with a calm editorial beauty still life. Subject: an open glass bottle of deep rose gel nail polish with brush, two closed gel polish bottles in muted nude and blush tones, a clean UV nail lamp partly visible, and a small folded cotton towel. Composition: close-up square framing, objects clearly recognizable at small mobile-card size, balanced visual weight, natural highlights and shadows. No hands, no faces, no real salon, no treatment result, no logos, no writing, no text, no watermark. This is an illustrative still life, not a claim about any real business.”

Prompt cuối cho `hair-removal.jpg`: “Use case: photorealistic-natural. Asset type: square category illustration for a BeautyBook mobile service card. Primary request: create a clear editorial still-life for Vietnamese laser hair-removal service ('Triệt lông'), as an illustrative image only. Scene/backdrop: warm ivory limestone surface, soft natural daylight, refined neutral beauty-spa palette. Subject: a modern generic handheld IPL/laser hair-removal device resting on a folded clean towel beside protective goggles and a small unbranded bottle of cooling gel; no person or body part. Composition: close, square, readable at small mobile-card size, crisp device silhouette, realistic texture. Do not show a real clinic, staff, customer, treatment in progress or outcome. No brand, logo, writing, text or watermark.”
