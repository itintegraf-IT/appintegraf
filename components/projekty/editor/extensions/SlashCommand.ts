import { Extension } from "@tiptap/core";
import Suggestion from "@tiptap/suggestion";
import { ReactRenderer } from "@tiptap/react";
import tippy, { type Instance } from "tippy.js";
import "tippy.js/dist/tippy.css";
import { filterBlocks, type Block } from "../blocks";
import {
  SlashMenuPopover,
  type SlashMenuPopoverRef,
} from "../SlashMenuPopover";

type SlashCommandOptions = {
  /** Bloky vyloučené ze slash menu — např. ["Obrázek"] když chybí cardId. */
  excludeBlocks: string[];
};

export const SlashCommand = Extension.create<SlashCommandOptions>({
  name: "slashCommand",
  addOptions() {
    return {
      excludeBlocks: [],
    };
  },
  addProseMirrorPlugins() {
    const exclude = this.options.excludeBlocks;
    return [
      Suggestion({
        editor: this.editor,
        char: "/",
        startOfLine: false,
        items: ({ query }) => filterBlocks(query, { exclude }).slice(0, 12),
        command: ({ editor, range, props }) => {
          // Smaž "/query" prefix
          editor.chain().focus().deleteRange(range).run();
          // Spusť command bloku
          (props as { block: Block }).block.command(editor);
        },
        render: () => {
          let component: ReactRenderer<SlashMenuPopoverRef> | null = null;
          let popup: Instance | null = null;

          return {
            onStart: (props) => {
              component = new ReactRenderer(SlashMenuPopover, {
                props: {
                  items: props.items,
                  command: (block: Block) => {
                    props.command({ block });
                  },
                  editor: props.editor,
                },
                editor: props.editor,
              });

              if (!props.clientRect) return;

              const rect = props.clientRect();
              if (!rect) return;

              // Append do nejbližšího Radix DialogContentu. Důvody:
              // 1. Scroll lock: Radix Dialog s modal=true wrappuje tree v
              //    <RemoveScroll>. Děti react-remove-scroll mají povolený scroll,
              //    elementy v body NE → tippy v body by neměl ani vnitřní scroll
              //    menu (ani myš nedosáhne wheel handleru).
              // 2. Pointer-events: body má pointer-events:none, dialog content auto.
              // Click-outside dismissal je OK, protože ReactRenderer rendruje
              // popover v hlavním React stromu (přes editor.contentComponent),
              // takže Radix DismissableLayer ho považuje za inside dialog tree.
              const dialogContent =
                props.editor.view.dom.closest<HTMLElement>('[data-slot="dialog-content"]') ??
                props.editor.view.dom.closest<HTMLElement>('[role="dialog"]');
              const appendTarget: HTMLElement = dialogContent ?? document.body;

              popup = tippy(appendTarget as Element, {
                getReferenceClientRect: () => rect,
                appendTo: () => appendTarget,
                content: component.element,
                showOnCreate: true,
                interactive: true,
                trigger: "manual",
                placement: "bottom-start",
                arrow: false,
                maxWidth: "none",
                offset: [0, 8],
                // fixed strategy + viewport boundary pro flip/preventOverflow.
                // Bez explicitní boundary tippy používá `clippingParents`, což
                // u modálního dialogu s overflow:hidden způsobí, že popover
                // zůstane mimo viewport, pokud je kurzor poblíž spodního okraje
                // (Callout/Media kategorie se ocitnou pod oknem prohlížeče).
                popperOptions: {
                  strategy: "fixed",
                  modifiers: [
                    {
                      name: "flip",
                      options: {
                        boundary: "viewport",
                        fallbackPlacements: ["top-start", "top-end", "bottom-end"],
                      },
                    },
                    {
                      name: "preventOverflow",
                      options: { boundary: "viewport", padding: 8 },
                    },
                  ],
                },
              });
            },
            onUpdate: (props) => {
              component?.updateProps({
                items: props.items,
                command: (block: Block) => {
                  props.command({ block });
                },
                editor: props.editor,
              });
              if (props.clientRect && popup) {
                const rect = props.clientRect();
                if (rect) popup.setProps({ getReferenceClientRect: () => rect });
              }
            },
            onKeyDown: (props) => {
              if (props.event.key === "Escape") {
                popup?.hide();
                return true;
              }
              return component?.ref?.onKeyDown?.(props) ?? false;
            },
            onExit: () => {
              popup?.destroy();
              component?.destroy();
              popup = null;
              component = null;
            },
          };
        },
      }),
    ];
  },
});
