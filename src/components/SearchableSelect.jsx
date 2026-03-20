import { useState } from "react";

const SearchableSelect = ({
  options,
  value,
  onChange,
  placeholder = "Select...",
  style = {},
}) => {
  const [filter, setFilter] = useState("");

  const filteredOptions = options.filter((opt) =>
    opt.toString().toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div
      className="searchable-select-wrapper"
      style={{ display: "flex", flexDirection: "column", ...style }}
    >
      <input
        type="text"
        className="tiny-search"
        placeholder="Search..."
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        onClick={(e) => e.stopPropagation()}
      />
      <select value={value} onChange={onChange} style={{ flex: 1 }}>
        <option value="">{placeholder}</option>
        {filteredOptions.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    </div>
  );
};

export default SearchableSelect;
