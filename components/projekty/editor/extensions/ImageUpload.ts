import { Extension } from "@tiptap/core";
import { Plugin } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";
import { toast } from "sonner";

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

export type ImageUploadOptions = {
  cardId: string;
};

export const ImageUpload = Extension.create<ImageUploadOptions>({
  name: "imageUpload",

  addOptions() {
    return { cardId: "" };
  },

  addProseMirrorPlugins() {
    const cardId = this.options.cardId;
    return [
      new Plugin({
        props: {
          handleDOMEvents: {
            paste: (view, event) => {
              const items = event.clipboardData?.items;
              if (!items) return false;
              for (const item of Array.from(items)) {
                if (item.type.startsWith("image/")) {
                  event.preventDefault();
                  const file = item.getAsFile();
                  if (file) void uploadAndInsert(view, file, cardId);
                  return true;
                }
              }
              return false;
            },
            drop: (view, event) => {
              const files = event.dataTransfer?.files;
              if (!files?.length) return false;
              const imageFile = Array.from(files).find((f) => f.type.startsWith("image/"));
              if (imageFile) {
                event.preventDefault();
                void uploadAndInsert(view, imageFile, cardId);
                return true;
              }
              return false;
            },
          },
        },
      }),
    ];
  },
});

export async function uploadAndInsert(view: EditorView, file: File, cardId: string) {
  if (file.size > MAX_BYTES) {
    toast.error("Obrázek je moc velký (max 5 MB).");
    return;
  }
  if (!ALLOWED.has(file.type)) {
    toast.error("Nepodporovaný formát obrázku.");
    return;
  }

  const formData = new FormData();
  formData.append("file", file);
  formData.append("parentType", "CARD");
  formData.append("parentId", cardId);

  try {
    const res = await fetch("/api/projekty/attachments", {
      method: "POST",
      body: formData,
    });
    if (!res.ok) {
      toast.error("Nahrání obrázku selhalo.");
      return;
    }
    const data = (await res.json()) as { attachment: { id: string; fileName: string } };
    const imageUrl = `/api/projekty/attachments/${data.attachment.id}/download`;

    const { schema } = view.state;
    const node = schema.nodes.image?.create({
      src: imageUrl,
      alt: data.attachment.fileName,
    });
    if (!node) {
      toast.error("Image extension není zaregistrována.");
      return;
    }
    const tr = view.state.tr.replaceSelectionWith(node);
    view.dispatch(tr);
  } catch {
    toast.error("Nahrání obrázku selhalo (chyba sítě).");
  }
}
