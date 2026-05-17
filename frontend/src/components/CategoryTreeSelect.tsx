import { useState } from "react";

export type PublicCategory = {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  imageUrl?: string | null;
  sortOrder?: number;
};

type CategoryNode = {
  category: PublicCategory;
  children: CategoryNode[];
  depth: number;
};

interface CategoryTreeSelectProps {
  categories: PublicCategory[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

function buildCategoryTree(categories: PublicCategory[]): CategoryNode[] {
  const byParent = new Map<string | null, PublicCategory[]>();
  for (const c of categories) {
    const k = c.parentId ?? null;
    const arr = byParent.get(k) ?? [];
    arr.push(c);
    byParent.set(k, arr);
  }

  function buildNode(parentId: string | null, depth = 0): CategoryNode[] {
    const children = byParent.get(parentId) ?? [];
    const sorted = children.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name, "pt"));
    return sorted.map((c) => ({
      category: c,
      children: buildNode(c.id, depth + 1),
      depth,
    }));
  }

  return buildNode(null, 0);
}

export default function CategoryTreeSelect({
  categories,
  value,
  onChange,
  placeholder = "Seleccionar categoria…",
}: CategoryTreeSelectProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [isOpen, setIsOpen] = useState(false);

  const tree = buildCategoryTree(categories);

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSelect = (id: string) => {
    onChange(id);
    setIsOpen(false);
  };

  const getSelectedLabel = () => {
    const selected = categories.find((c) => c.id === value);
    return selected?.name ?? placeholder;
  };

  const renderNode = (node: CategoryNode) => {
    const hasChildren = node.children.length > 0;
    const isExpanded = expandedIds.has(node.category.id);
    const isSelected = value === node.category.id;

    return (
      <div key={node.category.id}>
        <div
          className={`category-tree-node ${isSelected ? "category-tree-node--selected" : ""}`}
          style={{ paddingLeft: `${node.depth * 16 + 8}px` }}
          onClick={() => handleSelect(node.category.id)}
        >
          {hasChildren && (
            <span
              className="category-tree-expand"
              onClick={(e) => {
                e.stopPropagation();
                toggleExpand(node.category.id);
              }}
            >
              {isExpanded ? "▼" : "▶"}
            </span>
          )}
          {!hasChildren && <span className="category-tree-expand">　</span>}
          <span className="category-tree-label">{node.category.name}</span>
        </div>
        {hasChildren && isExpanded && (
          <div className="category-tree-children">
            {node.children.map((child) => renderNode(child))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="category-tree-select">
      <div
        className="category-tree-select-trigger"
        onClick={() => setIsOpen(!isOpen)}
      >
        {getSelectedLabel()}
        <span className="category-tree-select-arrow">{isOpen ? "▲" : "▼"}</span>
      </div>
      {isOpen && (
        <div className="category-tree-select-dropdown">
          {tree.map((node) => renderNode(node))}
        </div>
      )}
    </div>
  );
}
