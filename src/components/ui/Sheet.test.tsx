// @vitest-environment jsdom
import React from "react";
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ConfirmSheet, Sheet } from "@/src/components/ui/Sheet";

afterEach(() => {
  cleanup();
  document.body.style.overflow = "";
});

// The chore editor: a sheet with a "Delete?" confirmation stacked on top
function EditorWithConfirm({ confirmOpen }: { confirmOpen: boolean }) {
  return (
    <>
      <Sheet open onClose={() => {}} title="Edit chore">
        <input aria-label="name" />
      </Sheet>
      <ConfirmSheet open={confirmOpen} title="Delete?" message="Sure?" onConfirm={() => {}} onCancel={() => {}} />
    </>
  );
}

describe("Sheet scroll lock", () => {
  it("locks page scrolling while open and restores it when closed", () => {
    const { rerender } = render(<Sheet open onClose={() => {}} title="A">x</Sheet>);
    expect(document.body.style.overflow).toBe("hidden");
    rerender(<Sheet open={false} onClose={() => {}} title="A">x</Sheet>);
    expect(document.body.style.overflow).toBe("");
  });

  it("restores scrolling when stacked sheets close together (deleting a chore)", () => {
    const view = render(<EditorWithConfirm confirmOpen={false} />);
    view.rerender(<EditorWithConfirm confirmOpen />);
    expect(document.body.style.overflow).toBe("hidden");

    // Deleting closes the editor and the confirmation at the same moment
    act(() => view.unmount());
    expect(document.body.style.overflow).toBe("");
  });

  it("keeps scrolling locked while another sheet is still open", () => {
    const view = render(<EditorWithConfirm confirmOpen />);
    view.rerender(<EditorWithConfirm confirmOpen={false} />);
    expect(document.body.style.overflow).toBe("hidden");
  });
});
