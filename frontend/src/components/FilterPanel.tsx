import React, { useState, useRef } from 'react';
import {
  Box,
  Paper,
  TextField,
  MenuItem,
  Button,
  Chip,
  Grid,
  Collapse,
  Divider,
  Autocomplete,
  InputAdornment,
  Popper,
  ClickAwayListener,
} from '@mui/material';
import {
  Search as SearchIcon,
  Tune as TuneIcon,
  TrendingUp as CreditIcon,
  TrendingDown as DebitIcon,
} from '@mui/icons-material';
import { ModernDatePicker } from './ModernDatePicker';
import dayjs, { Dayjs } from 'dayjs';

export interface FilterConfig {
  showSearch?: boolean;
  showDateRange?: boolean;
  showQuickDatePresets?: boolean;
  showTransactionType?: boolean;
  showAccount?: boolean;
  showCategories?: boolean;
  showTags?: boolean;
  showAmountRange?: boolean;
  showReviewStatus?: boolean;
  collapsible?: boolean;
  defaultExpanded?: boolean;
  inline?: boolean;
}

export interface FilterValues {
  searchQuery?: string;
  startDate?: Dayjs | null;
  endDate?: Dayjs | null;
  activeDateFilter?: string;
  transactionType?: 'all' | 'credit' | 'debit';
  selectedAccount?: string;
  selectedCategories?: string[];
  includeTags?: string[];
  excludeTags?: string[];
  minAmount?: string;
  maxAmount?: string;
  amountQuickFilter?: string;
  reviewStatus?: 'all' | 'pending' | 'approved' | 'rejected';
}

export interface FilterPanelProps {
  config: FilterConfig;
  values: FilterValues;
  onChange: (values: FilterValues) => void;
  accounts?: any[];
  categories?: any[];
  tags?: any[];
  currencySymbol?: string;
  onClearAll?: () => void;
}

const FilterPanel: React.FC<FilterPanelProps> = ({
  config,
  values,
  onChange,
  accounts = [],
  categories = [],
  tags = [],
  currencySymbol = '$',
  onClearAll,
}) => {
  const [showFilters, setShowFilters] = useState(config.defaultExpanded ?? false);

  const updateValue = (key: keyof FilterValues, value: any) => {
    onChange({ ...values, [key]: value });
  };

  const hasActiveFilters = () => {
    return (
      (config.showSearch && values.searchQuery) ||
      (config.showTransactionType && values.transactionType !== 'all') ||
      (config.showAccount && values.selectedAccount) ||
      (config.showCategories && (values.selectedCategories?.length ?? 0) > 0) ||
      (config.showTags &&
        ((values.includeTags?.length ?? 0) > 0 || (values.excludeTags?.length ?? 0) > 0)) ||
      (config.showAmountRange && (values.minAmount || values.maxAmount)) ||
      (config.showReviewStatus && values.reviewStatus !== 'all')
    );
  };

  const handleClearAll = () => {
    if (onClearAll) {
      onClearAll();
    } else {
      onChange({
        searchQuery: '',
        startDate: null,
        endDate: null,
        activeDateFilter: '',
        transactionType: 'all',
        selectedAccount: '',
        selectedCategories: [],
        includeTags: [],
        excludeTags: [],
        minAmount: '',
        maxAmount: '',
        reviewStatus: 'all',
      });
    }
  };

  const setQuickDate = (preset: string) => {
    const now = dayjs();
    let start: Dayjs | null = null;
    let end: Dayjs | null = null;

    switch (preset) {
      case 'all':
        start = null;
        end = null;
        break;
      case 'today':
        start = now.startOf('day');
        end = now.endOf('day');
        break;
      case 'last7':
        start = now.subtract(7, 'days');
        end = now;
        break;
      case 'last30':
        start = now.subtract(30, 'days');
        end = now;
        break;
      case 'thisMonth':
        start = now.startOf('month');
        end = now.endOf('month');
        break;
      case 'lastMonth':
        start = now.subtract(1, 'month').startOf('month');
        end = now.subtract(1, 'month').endOf('month');
        break;
      case 'thisYear':
        start = now.startOf('year');
        end = now.endOf('year');
        break;
    }

    onChange({
      ...values,
      startDate: start,
      endDate: end,
      activeDateFilter: preset,
    });
  };

  const renderMainFilters = () => (
    <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
      {/* Search - only in non-inline mode */}
      {config.showSearch && !config.inline && (
        <TextField
          placeholder="Search transactions..."
          value={values.searchQuery || ''}
          onChange={(e) => updateValue('searchQuery', e.target.value)}
          size="small"
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
          }}
          sx={{ minWidth: 250, flexGrow: 1, maxWidth: 400 }}
        />
      )}

      {/* Review Status */}
      {config.showReviewStatus && (
        <TextField
          select
          value={values.reviewStatus || 'all'}
          onChange={(e) => updateValue('reviewStatus', e.target.value)}
          size="small"
          sx={{ minWidth: 140 }}
        >
          <MenuItem value="all">All Status</MenuItem>
          <MenuItem value="pending">Pending</MenuItem>
          <MenuItem value="approved">Approved</MenuItem>
          <MenuItem value="rejected">Rejected</MenuItem>
        </TextField>
      )}

      {config.collapsible && !config.inline && (
        <>
          <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
          <Button
            variant={showFilters ? 'contained' : 'outlined'}
            startIcon={<TuneIcon />}
            onClick={() => setShowFilters(!showFilters)}
            size="small"
          >
            Filters
          </Button>
        </>
      )}

      {/* Clear All */}
      {hasActiveFilters() && (
        <Chip
          label="Clear All"
          onDelete={handleClearAll}
          onClick={handleClearAll}
          color="primary"
          size="small"
          variant="outlined"
          sx={{ fontWeight: 500 }}
        />
      )}

      {/* Active Filter Indicators */}
      {config.showAccount && values.selectedAccount && (
        <Chip
          label={`Account: ${accounts.find((a) => a._id === values.selectedAccount)?.name || ''}`}
          onDelete={() => updateValue('selectedAccount', '')}
          size="small"
          color="info"
          variant="outlined"
        />
      )}
      {config.showCategories && (values.selectedCategories?.length ?? 0) > 0 && (
        <Chip
          label={`${values.selectedCategories?.length} ${values.selectedCategories?.length === 1 ? 'Category' : 'Categories'}`}
          onDelete={() => updateValue('selectedCategories', [])}
          size="small"
          color="info"
          variant="outlined"
        />
      )}
      {config.showTags &&
        ((values.includeTags?.length ?? 0) > 0 || (values.excludeTags?.length ?? 0) > 0) && (
          <Chip
            label={`${(values.includeTags?.length ?? 0) + (values.excludeTags?.length ?? 0)} Tag Filter${
              (values.includeTags?.length ?? 0) + (values.excludeTags?.length ?? 0) > 1 ? 's' : ''
            }`}
            onDelete={() => {
              updateValue('includeTags', []);
              updateValue('excludeTags', []);
            }}
            size="small"
            color="info"
            variant="outlined"
          />
        )}
      {config.showAmountRange && (values.minAmount || values.maxAmount) && (
        <Chip
          label="Amount Range"
          onDelete={() => {
            updateValue('minAmount', '');
            updateValue('maxAmount', '');
          }}
          size="small"
          color="info"
          variant="outlined"
        />
      )}
    </Box>
  );

  const renderAdvancedFilters = () => (
    <Collapse in={!config.collapsible || showFilters}>
      <Divider sx={{ my: 2 }} />

      {/* Transaction Type Chips - Inside collapsible section */}
      {config.showTransactionType && (
        <Box sx={{ mb: 2 }}>
          <Box display="flex" gap={1.5} flexWrap="wrap">
            <Chip
              label="All"
              onClick={() => updateValue('transactionType', 'all')}
              color={values.transactionType === 'all' ? 'primary' : 'default'}
              variant={values.transactionType === 'all' ? 'filled' : 'outlined'}
              size="medium"
              sx={{
                fontWeight: values.transactionType === 'all' ? 600 : 400,
                fontSize: '0.875rem',
                height: 32,
              }}
            />
            <Chip
              icon={<CreditIcon fontSize="small" />}
              label="Credits"
              onClick={() => updateValue('transactionType', 'credit')}
              color={values.transactionType === 'credit' ? 'success' : 'default'}
              variant={values.transactionType === 'credit' ? 'filled' : 'outlined'}
              size="medium"
              sx={{
                fontWeight: values.transactionType === 'credit' ? 600 : 400,
                fontSize: '0.875rem',
                height: 32,
              }}
            />
            <Chip
              icon={<DebitIcon fontSize="small" />}
              label="Debits"
              onClick={() => updateValue('transactionType', 'debit')}
              color={values.transactionType === 'debit' ? 'error' : 'default'}
              variant={values.transactionType === 'debit' ? 'filled' : 'outlined'}
              size="medium"
              sx={{
                fontWeight: values.transactionType === 'debit' ? 600 : 400,
                fontSize: '0.875rem',
                height: 32,
              }}
            />
          </Box>
        </Box>
      )}

      <Grid container spacing={1.5}>
        {/* Account Filter */}
        {config.showAccount && (
          <Grid size={{ xs: 12 }}>
            <TextField
              select
              label="Account"
              value={values.selectedAccount || ''}
              onChange={(e) => updateValue('selectedAccount', e.target.value)}
              fullWidth
              size="small"
            >
              <MenuItem value="">All Accounts</MenuItem>
              {accounts.map((account) => (
                <MenuItem key={account._id} value={account._id}>
                  {account.name}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
        )}

        {/* Category Filter */}
        {config.showCategories && (
          <Grid size={{ xs: 12 }}>
            <Autocomplete
              multiple
              options={categories}
              getOptionLabel={(option) => option.name}
              value={categories.filter((c: any) =>
                (values.selectedCategories || []).includes(c._id)
              )}
              onChange={(_, newValue) =>
                updateValue(
                  'selectedCategories',
                  newValue.map((c: any) => c._id)
                )
              }
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Categories"
                  size="small"
                  placeholder="Select categories..."
                />
              )}
              renderOption={(props, option) => (
                <li {...props}>
                  {option.isFolder ? '📁 ' : ''}
                  {option.name}
                </li>
              )}
              renderTags={(value, getTagProps) =>
                value.map((option, index) => (
                  <Chip
                    label={option.isFolder ? `📁 ${option.name}` : option.name}
                    size="small"
                    style={{ backgroundColor: option.color || '#667eea', color: '#fff' }}
                    {...getTagProps({ index })}
                    key={option._id || index}
                  />
                ))
              }
              size="small"
            />
          </Grid>
        )}

        {/* Date Range */}
        {config.showDateRange && (
          <>
            <Grid size={{ xs: 12 }}>
              <ModernDatePicker
                label="Start Date"
                value={values.startDate || null}
                onChange={(date) => {
                  updateValue('startDate', date);
                  updateValue('activeDateFilter', '');
                }}
                fullWidth
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <ModernDatePicker
                label="End Date"
                value={values.endDate || null}
                onChange={(date) => {
                  updateValue('endDate', date);
                  updateValue('activeDateFilter', '');
                }}
                fullWidth
              />
            </Grid>
          </>
        )}

        {/* Quick Date Presets */}
        {config.showQuickDatePresets && (
          <Grid size={{ xs: 12 }}>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              {[
                { label: 'All Time', value: 'all' },
                { label: 'Today', value: 'today' },
                { label: 'Last 7 Days', value: 'last7' },
                { label: 'Last 30 Days', value: 'last30' },
                { label: 'This Month', value: 'thisMonth' },
                { label: 'Last Month', value: 'lastMonth' },
                { label: 'This Year', value: 'thisYear' },
              ].map((preset) => (
                <Chip
                  key={preset.value}
                  label={preset.label}
                  size="small"
                  variant={values.activeDateFilter === preset.value ? 'filled' : 'outlined'}
                  color={values.activeDateFilter === preset.value ? 'primary' : 'default'}
                  onClick={() => setQuickDate(preset.value)}
                  sx={{ cursor: 'pointer' }}
                />
              ))}
            </Box>
          </Grid>
        )}

        {/* Tag Filters */}
        {config.showTags && (
          <>
            <Grid size={{ xs: 12 }}>
              <Autocomplete
                multiple
                options={tags.map((t: any) => t.name)}
                value={values.includeTags || []}
                onChange={(_, value) => updateValue('includeTags', value)}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Include Tags (show WITH these)"
                    size="small"
                    placeholder="Select tags to include..."
                  />
                )}
                size="small"
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <Autocomplete
                multiple
                options={tags.map((t: any) => t.name)}
                value={values.excludeTags || []}
                onChange={(_, value) => updateValue('excludeTags', value)}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Exclude Tags (hide WITH these)"
                    size="small"
                    placeholder="Select tags to exclude..."
                  />
                )}
                size="small"
              />
            </Grid>
          </>
        )}

        {/* Amount Range */}
        {config.showAmountRange && (
          <>
            <Grid size={{ xs: 12 }}>
              <TextField
                label="Min Amount"
                type="number"
                value={values.minAmount || ''}
                onChange={(e) => updateValue('minAmount', e.target.value)}
                fullWidth
                size="small"
                inputProps={{ min: 0, step: 0.01 }}
                InputProps={{
                  startAdornment: <span style={{ marginRight: 4 }}>{currencySymbol}</span>,
                }}
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField
                label="Max Amount"
                type="number"
                value={values.maxAmount || ''}
                onChange={(e) => updateValue('maxAmount', e.target.value)}
                fullWidth
                size="small"
                inputProps={{ min: 0, step: 0.01 }}
                InputProps={{
                  startAdornment: <span style={{ marginRight: 4 }}>{currencySymbol}</span>,
                }}
              />
            </Grid>
          </>
        )}
      </Grid>
    </Collapse>
  );

  const anchorRef = useRef<HTMLButtonElement>(null);
  const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null);

  // Inline mode: render just the button and collapsible content
  if (config.inline) {
    return (
      <ClickAwayListener onClickAway={() => showFilters && setShowFilters(false)}>
        <Box>
          <Button
            ref={(node) => {
              anchorRef.current = node;
              setAnchorEl(node);
            }}
            variant={showFilters ? 'contained' : 'outlined'}
            startIcon={<TuneIcon />}
            onClick={() => setShowFilters(!showFilters)}
            size="medium"
            sx={{
              bgcolor: showFilters ? 'primary.main' : 'action.hover',
              '&:hover': { bgcolor: showFilters ? 'primary.dark' : 'action.selected' },
            }}
          >
            Filters
          </Button>
          <Popper
            open={showFilters}
            anchorEl={anchorEl}
            placement="bottom-end"
            sx={{ zIndex: 1300 }}
            modifiers={[
              {
                name: 'offset',
                options: {
                  offset: [0, 8],
                },
              },
            ]}
          >
            <Paper
              sx={{
                p: 1.5,
                borderRadius: 3,
                border: '1px solid',
                borderColor: 'divider',
                boxShadow: 3,
                width: 400,
                maxWidth: '90vw',
                maxHeight: '80vh',
                overflow: 'auto',
              }}
            >
              {renderAdvancedFilters()}
            </Paper>
          </Popper>
        </Box>
      </ClickAwayListener>
    );
  }

  // Standard mode: render with Paper wrapper
  return (
    <Paper
      sx={{
        p: 3,
        mb: 3,
        borderRadius: 3,
        border: '1px solid',
        borderColor: 'divider',
      }}
    >
      {renderMainFilters()}
      {renderAdvancedFilters()}
    </Paper>
  );
};

export default FilterPanel;
