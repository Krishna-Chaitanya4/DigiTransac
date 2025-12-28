import React, { useState } from 'react';
import {
  Box,
  Paper,
  TextField,
  MenuItem,
  Chip,
  IconButton,
  Collapse,
  Grid,
  Autocomplete,
  ToggleButtonGroup,
  ToggleButton,
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
} from '@mui/icons-material';
import { ModernDatePicker } from './ModernDatePicker';
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
  includeTags: string[];
  excludeTags: string[];
  transactionType: 'all' | 'debit' | 'credit';
  amountRange: {
    min: string;
    max: string;
    quickFilter: 'any' | 'small' | 'medium' | 'large' | 'veryLarge' | 'custom';
  };
}

interface FilterBarProps {
  filters: FilterValues;
  onFiltersChange: (filters: FilterValues) => void;
  accounts: Array<{ id: string; name: string; icon?: string }>;
  categories: Array<{ id: string; name: string; color?: string; isFolder?: boolean }>;
  tags: Array<{ id: string; name: string; color?: string }>;
  showTransactionType?: boolean;
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

const FilterBarComponent: React.FC<FilterBarProps> = ({
  filters,
  onFiltersChange,
  accounts,
  categories,
  tags,
  showTransactionType = false,
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
      includeTags: [],
      excludeTags: [],
      transactionType: 'all',
      amountRange: {
        min: '',
        max: '',
        quickFilter: 'any',
      },
    });
    setDatePreset('thisMonth');
  };

  const hasActiveFilters =
    filters.accounts.length > 0 ||
    filters.categories.length > 0 ||
    filters.includeTags.length > 0 ||
    filters.excludeTags.length > 0 ||
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
              <ModernDatePicker
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
              />
              <ModernDatePicker
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
              />
            </LocalizationProvider>
          )}

          {hasActiveFilters && (
            <Chip
              label={`${filters.accounts.length + filters.categories.length + filters.includeTags.length + filters.excludeTags.length} filters`}
              color="primary"
              variant="outlined"
              size="small"
            />
          )}
        </Box>

        <Box sx={{ display: 'flex', gap: 1 }}>
          <IconButton 
            size="small" 
            onClick={handleReset} 
            title="Reset Filters"
            sx={{
              color: 'primary.main',
              '&:hover': {
                bgcolor: 'primary.lighter',
                transform: 'rotate(-180deg)',
              },
              transition: 'all 0.4s ease',
            }}
          >
            <RefreshIcon />
          </IconButton>
          <IconButton size="small" onClick={() => setExpanded(!expanded)}>
            {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </IconButton>
        </Box>
      </Box>

      <Collapse in={expanded}>
        <Grid container spacing={2} sx={{ mt: 1 }}>
          <Grid size={{ sm: 6, xs: 12, md: 3 }}>
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

          <Grid size={{ sm: 6, xs: 12, md: 3 }}>
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

          <Grid size={{ sm: 6, xs: 12, md: 3 }}>
            <Autocomplete
              multiple
              size="small"
              options={tags}
              getOptionLabel={(option) => option.name}
              value={tags.filter((t) => filters.includeTags.includes(t.id))}
              onChange={(_, newValue) => {
                onFiltersChange({
                  ...filters,
                  includeTags: newValue.map((v) => v.id),
                });
              }}
              renderInput={(params) => (
                <TextField {...params} label="Include Tags" placeholder="Any of these" />
              )}
              renderTags={(value, getTagProps) =>
                value.map((option, index) => (
                  <Chip
                    label={option.name}
                    size="small"
                    color="success"
                    {...getTagProps({ index })}
                  />
                ))
              }
            />
          </Grid>

          <Grid size={{ sm: 6, xs: 12, md: 3 }}>
            <Autocomplete
              multiple
              size="small"
              options={tags}
              getOptionLabel={(option) => option.name}
              value={tags.filter((t) => filters.excludeTags.includes(t.id))}
              onChange={(_, newValue) => {
                onFiltersChange({
                  ...filters,
                  excludeTags: newValue.map((v) => v.id),
                });
              }}
              renderInput={(params) => (
                <TextField {...params} label="Exclude Tags" placeholder="None of these" />
              )}
              renderTags={(value, getTagProps) =>
                value.map((option, index) => (
                  <Chip
                    label={option.name}
                    size="small"
                    color="error"
                    {...getTagProps({ index })}
                  />
                ))
              }
            />
          </Grid>

          {showTransactionType && (
            <Grid size={{ sm: 6, xs: 12, md: 3 }}>
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

          {/* Amount Range Filters */}
          <Grid size={{ xs: 12 }}>
            <Box>
              <ToggleButtonGroup
                size="small"
                value={filters.amountRange.quickFilter}
                exclusive
                onChange={(_, newValue) => {
                  if (newValue !== null) {
                    let min = '', max = '';
                    switch (newValue) {
                      case 'small':
                        min = '0';
                        max = '50';
                        break;
                      case 'medium':
                        min = '50';
                        max = '200';
                        break;
                      case 'large':
                        min = '200';
                        max = '1000';
                        break;
                      case 'veryLarge':
                        min = '1000';
                        max = '';
                        break;
                      case 'any':
                      case 'custom':
                      default:
                        min = '';
                        max = '';
                    }
                    onFiltersChange({
                      ...filters,
                      amountRange: { min, max, quickFilter: newValue },
                    });
                  }
                }}
                fullWidth
                sx={{ mb: 2 }}
              >
                <ToggleButton value="any">Any Amount</ToggleButton>
                <ToggleButton value="small">Small ($0-$50)</ToggleButton>
                <ToggleButton value="medium">Medium ($50-$200)</ToggleButton>
                <ToggleButton value="large">Large ($200-$1K)</ToggleButton>
                <ToggleButton value="veryLarge">Very Large (&gt;$1K)</ToggleButton>
                <ToggleButton value="custom">Custom</ToggleButton>
              </ToggleButtonGroup>
            </Box>
          </Grid>

          {filters.amountRange.quickFilter === 'custom' && (
            <>
              <Grid size={{ sm: 6, xs: 12, md: 3 }}>
                <TextField
                  label="Min Amount"
                  type="number"
                  value={filters.amountRange.min}
                  onChange={(e) => {
                    onFiltersChange({
                      ...filters,
                      amountRange: {
                        ...filters.amountRange,
                        min: e.target.value,
                      },
                    });
                  }}
                  placeholder="0"
                  fullWidth
                  size="small"
                  InputProps={{
                    startAdornment: <span style={{ marginRight: 4 }}>$</span>,
                  }}
                />
              </Grid>
              <Grid size={{ sm: 6, xs: 12, md: 3 }}>
                <TextField
                  label="Max Amount"
                  type="number"
                  value={filters.amountRange.max}
                  onChange={(e) => {
                    onFiltersChange({
                      ...filters,
                      amountRange: {
                        ...filters.amountRange,
                        max: e.target.value,
                      },
                    });
                  }}
                  placeholder="Unlimited"
                  fullWidth
                  size="small"
                  InputProps={{
                    startAdornment: <span style={{ marginRight: 4 }}>$</span>,
                  }}
                />
              </Grid>
            </>
          )}
        </Grid>
      </Collapse>
    </Paper>
  );
};

export const FilterBar = React.memo(FilterBarComponent);
