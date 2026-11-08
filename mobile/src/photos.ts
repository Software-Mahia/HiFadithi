import { Platform } from "react-native";

import * as ImagePicker from "expo-image-picker";
import type { ImagePickerAsset } from "expo-image-picker";

import type { PhotoFile } from "./api";

export type PickedImage = { uri: string; photo: PhotoFile };

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

/** Web: expo-image-picker's library picker is unreliable in the browser, so open
 * a real <input type="file"> instead. It MUST be clicked synchronously inside the
 * tap handler (no await before this call) or the browser blocks the file dialog. */
function pickImageWeb(): Promise<PickedImage | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.style.display = "none";
    let settled = false;
    const finish = (value: PickedImage | null) => {
      if (settled) return;
      settled = true;
      input.remove();
      resolve(value);
    };
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return finish(null);
      const uri = URL.createObjectURL(file);
      finish({ uri, photo: { uri, name: file.name || "photo.jpg", type: file.type || "image/jpeg" } });
    };
    // Fired when the dialog is dismissed without choosing a file (modern browsers).
    input.oncancel = () => finish(null);
    document.body.appendChild(input);
    input.click();
  });
}

/** Open the device photo library and return the chosen image, or null if the
 * person cancels. Web uses a file input; native uses expo-image-picker. */
export async function pickImageFromLibrary(): Promise<PickedImage | null> {
  if (Platform.OS === "web") return pickImageWeb();
  const picked = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    quality: 0.9,
    allowsMultipleSelection: false,
  });
  if (picked.canceled || !picked.assets[0]) return null;
  const asset = picked.assets[0];
  return { uri: asset.uri, photo: photoFromAsset(asset) };
}
