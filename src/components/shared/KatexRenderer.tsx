"use client"

import React from 'react';
import { BlockMath, InlineMath } from 'react-katex';

interface KatexRendererProps {
  content: string;
}

export const KatexRenderer: React.FC<KatexRendererProps> = ({ content }) => {
  // Regex to find all occurrences of $$...$$ (for block) and $...$ (for inline, not used here but good to know)
  const blockRegex = /\$\$(.*?)\$\$/g;
  
  const parts = content.split(blockRegex);

  return (
    <span>
      {parts.map((part, index) => {
        // Every second part is a formula
        if (index % 2 === 1) {
          try {
            // Using InlineMath but it behaves like block with displayMode
            // Using BlockMath would wrap it in a div, which might break layout inside a label.
            // InlineMath with displayMode is more flexible.
            return <InlineMath key={index} math={part} />;
          } catch (e) {
            console.error("Katex rendering error for:", part, e);
            return <span key={index} className="text-red-500">Помилка формули</span>;
          }
        } else {
          return <span key={index}>{part}</span>;
        }
      })}
    </span>
  );
};
