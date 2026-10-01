"use client";

import { deleteListing } from "@/app/(app)/listings/actions";

export function DeleteListingButton({ id, title }: { id: string; title: string }) {
  return (
    <form
      action={deleteListing}
      onSubmit={(ev) => {
        if (!confirm(`Delete "${title}"? This can't be undone. To hide it temporarily, archive it instead.`)) {
          ev.preventDefault();
        }
      }}
    >
      <input type="hidden" name="id" value={id} />
      <button type="submit" className="btn btn-danger">
        Delete listing
      </button>
    </form>
  );
}
