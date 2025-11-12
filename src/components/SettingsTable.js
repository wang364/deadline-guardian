import React, { useState } from 'react';
import { Box, Button, Textfield, DynamicTable } from '@forge/react';

const SettingsTable = ({ settings, setSettings }) => {
  // Use functional updates to avoid stale closures and race conditions
  const addRow = () => {
    setSettings(prev => [...prev, { field: '', condition: '', threshold: '' }]);
  };

  const deleteRow = (index) => {
    setSettings(prev => {
      const newSettings = [...prev];
      newSettings.splice(index, 1);
      // Ensure at least one empty row exists
      if (newSettings.length === 0) {
        newSettings.push({ field: '', condition: '', threshold: '' });
      }
      return newSettings;
    });
  };

  const handleChange = (index, field, value) => {
    setSettings(prev => {
      const newSettings = prev.map((s, i) => (i === index ? { ...s, [field]: value } : s));
      return newSettings;
    });
  };

  // Prepare table header
  const head = {
    cells: [
      {
        key: "field",
        content: "Field",
        isSortable: true,
      },
      {
        key: "condition",
        content: "Condition",
        shouldTruncate: true,
        isSortable: false,
      },
      {
        key: "threshold",
        content: "Threshold",
        shouldTruncate: true,
        isSortable: false,
      },
      {
        key: "actions",
        content: "Actions",
        shouldTruncate: true,
        isSortable: false,
      },
    ],
  };

  // Prepare row data
  const rows = settings.map((setting, index) => ({
    key: `row-${index}`,
    cells: [
      {
        key: `field-${index}`,
        content: (
          <Textfield
            value={setting.field}
            // @forge/react Textfield onChange provides the new value directly
            onChange={(value) => handleChange(index, 'field', value)}
            placeholder="Field"
          />
        ),
      },
      {
        key: `condition-${index}`,
        content: (
          <Textfield
            value={setting.condition}
            onChange={(value) => handleChange(index, 'condition', value)}
            placeholder="Condition"
          />
        ),
      },
      {
        key: `threshold-${index}`,
        content: (
          <Textfield
            value={setting.threshold}
            onChange={(value) => handleChange(index, 'threshold', value)}
            placeholder="Threshold"
          />
        ),
      },
      {
        key: `actions-${index}`,
        content: (
          <Button appearance="danger" onClick={() => deleteRow(index)}>Delete</Button>
        ),
      },
    ],
  }));

  return (
    <Box padding="space.200">
      <DynamicTable
        caption='Condition Settings'
        head={head}
        rows={rows}
        isFixedSize
      />
      <Box padding="medium" paddingTop="none">
        <Button appearance="primary" onClick={addRow}>Add New Row</Button>
      </Box>
    </Box>
  );
};

export default SettingsTable;