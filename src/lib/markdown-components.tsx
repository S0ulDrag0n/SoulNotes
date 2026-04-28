// Shared markdown components for consistent GFM rendering
// Used by SummaryPanel and OutputPanel

import type { Components } from 'react-markdown';

export const markdownComponents: Components = {
  // Lists
  ul: (props) => (
    <ul className="list-disc list-inside space-y-1 my-3" {...props} />
  ),
  ol: (props) => (
    <ol className="list-decimal list-inside space-y-1 my-3" {...props} />
  ),
  // Paragraphs and headers
  p: (props) => <p className="mb-4 leading-relaxed" {...props} />,
  h1: (props) => (
    <h1 className="text-xl font-bold mt-8 mb-4 first:mt-0" {...props} />
  ),
  h2: (props) => (
    <h2 className="text-lg font-semibold mt-6 mb-3 first:mt-0" {...props} />
  ),
  h3: (props) => (
    <h3 className="text-base font-semibold mt-5 mb-2 first:mt-0" {...props} />
  ),
  h4: (props) => (
    <h4 className="text-sm font-semibold mt-4 mb-2 first:mt-0" {...props} />
  ),
  // GFM: Tables
  table: (props) => (
    <div className="overflow-x-auto my-3">
      <table className="min-w-full border-collapse border border-black/20 dark:border-white/20" {...props} />
    </div>
  ),
  thead: (props) => (
    <thead className="bg-black/5 dark:bg-white/5" {...props} />
  ),
  th: (props) => (
    <th className="border border-black/20 px-3 py-2 text-left font-semibold dark:border-white/20" {...props} />
  ),
  td: (props) => (
    <td className="border border-black/20 px-3 py-2 dark:border-white/20" {...props} />
  ),
  // GFM: Task lists (checkboxes)
  input: (props) => {
    if (props.type === 'checkbox') {
      return (
        <input
          type="checkbox"
          className="mr-2 h-4 w-4 rounded border-black/30 dark:border-white/30 accent-amber-500"
          disabled
          {...props}
        />
      );
    }
    return <input {...props} />;
  },
  // GFM: Strikethrough
  del: (props) => (
    <del className="line-through text-[#6b5a3f] dark:text-[#a08a68]" {...props} />
  ),
  // Links
  a: (props) => (
    <a
      className="text-amber-600 dark:text-amber-400 hover:underline"
      target="_blank"
      rel="noopener noreferrer"
      {...props}
    />
  ),
};