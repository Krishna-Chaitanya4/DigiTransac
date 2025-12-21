import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  TextField,
  MenuItem,
  Chip,
  Button,
  IconButton,
  Collapse,
  Grid,
  Autocomplete,
  ToggleButtonGroup,
  ToggleButton,
  Typography,
} from '@mui/material';
import {
  FilterList as FilterListIcon,
  Close as CloseIcon,
  Refresh as RefreshIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs, { Dayjs } from 'dayjs';

export interface FilterValues {
  dateRange: {
    start: Dayjs;
    end: Dayjs;
    preset?: string;
  };
  accounts: string[];
  categories: string[];
  tags: string[];
  transactionType: 'all' | 'debit' | 'credit';
}

interface FilterBarProps {
  filters: FilterValues;
  onFiltersChange: (filters: FilterValues) => void;
  accounts: Array<{ id: string; name: string; icon?: string }>;
  categories: Array<{ id: string; name: string; color?: string; isFolder?: boolean }>;
  tags: Array<{ id: string; name: string; color?: string }>;
  showTransactionType?: boolean;
  showComparison?: boolean;
}

const DATE_PRESETS = [
  { label: 'This Month', value: 'thisMonth' },
  { label: 'Last Month', value: 'lastMonth' },
  { label: 'Last 3 Months', value: 'last3Months' },
  { label: 'Last 6 Months', value: 'last6Months' },
  { label: 'This Year', value: 'thisYear' },
  { label: 'Last Year', value: 'lastYear' },
  { label: 'Custom', value: 'custom' },
];

export const FilterBar: React.FC<FilterBarProps> = ({
  filters,
  onFiltersChange,
  accounts,
  categories,
  tags,
  showTransactionType = false,
  showComparison = false,
}) => {
  const [expanded, setExpanded] = useState(false);
  const [datePreset, setDatePreset] = useState('thisMonth');

  const applyDatePreset = (preset: string) => {
    const now = dayjs();
    let start: Dayjs, end: Dayjs;

    switch (preset) {
      case 'thisMonth':
        start = now.startOf('month');
        end = now.endOf('month');
        break;
      case 'lastMonth':
        start = now.subtract(1, 'month').startOf('month');
        end = now.subtract(1, 'month').endOf('month');
        break;
      case 'last3Months':
        start = now.subtract(3, 'month').startOf('month');
        end = now.endOf('month');
        break;
      case 'last6Months':
        start = now.subtract(6, 'month').startOf('month');
        end = now.endOf('month');
        break;
      case 'thisYear':
        start = now.startOf('year');
        end = now.endOf('year');
        break;
      case 'lastYear':
        start = now.subtract(1, 'year').startOf('year');
        end = now.subtract(1, 'year').endOf('year');
        break;
      default: // custom
        return;
    }

    setDatePreset(preset);
    onFiltersChange({
      ...filters,
      dateRange: { start, end, preset },
    });
  };

  const handleReset = () => {
    const now = dayjs();
    onFiltersChange({
      dateRange: {
        start: now.startOf('month'),
        end: now.endOf('month'),
        preset: 'thisMonth',
      },
      accounts: [],
      categories: [],
      tags: [],
      transactionType: 'all',
    });
    setDatePreset('thisMonth');
  };

  const hasActiveFilters =
    filters.accounts.length > 0 ||
    filters.categories.length > 0 ||
    filters.tags.length > 0 ||
    filters.transactionType !== 'all';

  return (
    <Paper sx={{ p: 2, mb: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: expanded ? 2 : 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap', flex: 1 }}>
          <TextField
            select
            size="small"
            value={datePreset}
            onChange={(e) => applyDatePreset(e.target.value)}
            sx={{ minWidth: 150 }}
            label="Period"
          >
            {DATE_PRESETS.map((preset) => (
              <MenuItem key={preset.value} value={preset.value}>
                {preset.label}
              </MenuItem>
            ))}
          </TextField>

          {datePreset === 'custom' && (
            <LocalizationProvider dateAdapter={AdapterDayjs}>
              <DatePicker
                label="Start Date"
                value={filters.dateRange.start}
                onChange={(newValue) => {
                  if (newValue) {
                    onFiltersChange({
                      ...filters,
                      dateRange: { ...filters.dateRange, start: newValue },
                    });
                  }
                }}
                slotProps={{ textField: { size: 'small' } }}
              />
              <DatePicker
                label="End Date"
                value={filters.dateRange.end}
                onChange={(newValue) => {
                  if (newValue) {
                    onFiltersChange({
                      ...filters,
                      dateRange: { ...filters.dateRange, end: newValue },
                    });
                  }
                }}
                slotProps={{ textField: { size: 'small' } }}
              />
            </LocalizationProvider>
          )}

          {hasActiveFilters && (
            <Chip
              label={`${filters.accounts.length + filters.categories.length + filters.tags.length} filters`}
              color="primary"
              variant="outlined"
              size="small"
            />
          )}
        </Box>

        <Box sx={{ display: 'flex', gap: 1 }}>
          <IconButton size="small" onClick={handleReset} title="Reset Filters">
            <RefreshIcon />
          </IconButton>
          <IconButton size="small" onClick={() => setExpanded(!expanded)}>
            {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </IconButton>
        </Box>
      </Box>

      <Collapse in={expanded}>
        <Grid container spacing={2} sx={{ mt: 1 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Autocomplete
              multiple
              size="small"
              options={accounts}
              getOptionLabel={(option) => option.name}
              value={accounts.filter((a) => filters.accounts.includes(a.id))}
              onChange={(_, newValue) => {
                onFiltersChange({
                  ...filters,
                  accounts: newValue.map((v) => v.id),
                });
              }}
              renderInput={(params) => (
                <TextField {...params} label="Accounts" placeholder="Select accounts" />
              )}
              renderTags={(value, getTagProps) =>
                value.map((option, index) => (
                  <Chip
                    label={option.name}
                    size="small"
                    {...getTagProps({ index })}
                  />
                ))
              }
            />
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Autocomplete
              multiple
              size="small"
              options={categories.filter((c) => !c.isFolder)}
              getOptionLabel={(option) => option.name}
              value={categories.filter((c) => filters.categories.includes(c.id))}
              onChange={(_, newValue) => {
                onFiltersChange({
                  ...filters,
                  categories: newValue.map((v) => v.id),
                });
              }}
              renderInput={(params) => (
                <TextField {...params} label="Categories" placeholder="Select categories" />
              )}
              renderTags={(value, getTagProps) =>
                value.map((option, index) => (
                  <Chip
                    label={option.name}
                    size="small"
                    sx={{
                      backgroundColor: option.color || undefined,
                      color: option.color ? '#fff' : undefined,
                    }}
                    {...getTagProps({ index })}
                  />
                ))
              }
            />
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Autocomplete
              multiple
              size="small"
              options={tags}
              getOptionLabel={(option) => option.name}
              value={tags.filter((t) => filters.tags.includes(t.id))}
              onChange={(_, newValue) => {
                onFiltersChange({
                  ...filters,
                  tags: newValue.map((v) => v.id),
                });
              }}
              renderInput={(params) => (
                <TextField {...params} label="Tags" placeholder="Select tags" />
              )}
              renderTags={(value, getTagProps) =>
                value.map((option, index) => (
                  <Chip
                    label={option.name}
                    size="small"
                    {...getTagProps({ index })}
                  />
                ))
              }
            />
          </Grid>

          {showTransactionType && (
            <Grid item xs={12} sm={6} md={3}>
              <ToggleButtonGroup
                size="small"
                value={filters.transactionType}
                exclusive
                onChange={(_, newValue) => {
                  if (newValue !== null) {
                    onFiltersChange({
                      ...filters,
                      transactionType: newValue,
                    });
                  }
                }}
                fullWidth
              >
                <ToggleButton value="all">All</ToggleButton>
                <ToggleButton value="debit">Expenses</ToggleButton>
                <ToggleButton value="credit">Income</ToggleButton>
              </ToggleButtonGroup>
            </Grid>
          )}
        </Grid>
      </Collapse>
    </Paper>
  );
};
