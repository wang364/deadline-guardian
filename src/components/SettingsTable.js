import React, { useState } from 'react';
import { Box, Button, Textfield, DynamicTable } from '@forge/react';

const SettingsTable = ({ settings, setSettings }) => {
  const addRow = () => {
    setSettings([...settings, { field: '', condition: '', threshold: '' }]);
  };

  const deleteRow = (index) => {
    const newSettings = [...settings];
    newSettings.splice(index, 1);
    // Ensure at least one empty row exists
    if (newSettings.length === 0) {
      newSettings.push({ field: '', condition: '', threshold: '' });
    }
    setSettings(newSettings);
  };

  const handleChange = (index, field, value) => {
    const newSettings = [...settings];
    newSettings[index][field] = value;
    setSettings(newSettings);
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
            onChange={(e) => handleChange(index, 'field', e.target.value)}
            placeholder="Field"
          />
        ),
      },
      {
        key: `condition-${index}`,
        content: (
          <Textfield
            value={setting.condition}
            onChange={(e) => handleChange(index, 'condition', e.target.value)}
            placeholder="Condition"
          />
        ),
      },
      {
        key: `threshold-${index}`,
        content: (
          <Textfield
            value={setting.threshold}
            onChange={(e) => handleChange(index, 'threshold', e.target.value)}
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
    <Box>
      <DynamicTable
        caption='User Settings'
        head={head}
        rows={rows}
        isFixedSize
      />
      <Box padding="medium">
        <Button appearance="primary" onClick={addRow}>Add New Row</Button>
      </Box>
    </Box>
  );
};

export default SettingsTable;