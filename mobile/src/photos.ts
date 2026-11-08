import type { ImagePickerAsset } from "expo-image-picker";

import type { PhotoFile } from "./api";

export function photoFromAsset(asset: ImagePickerAsset): PhotoFile {
  const extension =
    asset.fileName?.split(".").pop() ||
    asset.mimeType?.split("/").pop() ||
    (asset.uri.toLowerCase().endsWith(".png") ? "png" : "jpg");
  return {
    uri: asset.uri,
    name: asset.fileName || `photo.${extension}`,
    type: asset.mimeType || (extension === "png" ? "image/png" : "image/jpeg"),
  };
}
