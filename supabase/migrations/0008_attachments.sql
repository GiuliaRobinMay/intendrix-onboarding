-- Intendrix — one attachment per lesson email
--
-- Some lessons travel with a file — a workbook, a Leaders Guide as PDF.
-- Each email variant can carry one attachment: a display name and the
-- direct link to the file. The engine hands the link to the email
-- provider, which fetches the file and attaches it to the message.
--
-- The link must point straight at the file (a share page is not a file).

alter table step_contents
  add column if not exists attachment_label text,
  add column if not exists attachment_url   text;

comment on column step_contents.attachment_url is
  'Direct https link to the file this email carries as an attachment. Null = no attachment.';
