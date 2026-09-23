// The order a portfolio photo is deleted in, kept apart from Supabase so it
// can be tested. The database row goes first: PostgreSQL may refuse it (a
// published page keeps at least one visible photo, 202609220003) and the
// stored file must survive that. Only once the row is gone is the file
// removed; if that fails the photo has still left the portfolio, and the
// private orphaned object is reported to onOrphan instead of failing the
// provider's request.
export async function deleteRowThenFile({ deleteRow, removeFile, onOrphan }) {
  const { error: rowError } = await deleteRow();

  if (rowError) {
    return { status: "refused", error: rowError };
  }

  const { error: fileError } = await removeFile();

  if (fileError) {
    onOrphan(fileError);
  }

  return { status: "deleted", orphaned: Boolean(fileError) };
}
