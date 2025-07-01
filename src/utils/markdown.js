// Escape special Markdown characters in text
function escapeMarkdown(text) {
  if (!text) return '';
  return text.replace(/[_*[\]()~`>#+=|{}.!-]/g, '\\$&');
}

// Clean text by removing problematic characters
function cleanText(text) {
  if (!text) return '';
  return text.replace(/[*_`[\]]/g, '');
}

module.exports = {
  escapeMarkdown,
  cleanText
};