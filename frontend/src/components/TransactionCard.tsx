import React from 'react';
import {
  Card,
  CardContent,
  Box,
  Typography,
  Chip,
  IconButton,
  Collapse,
  Divider,
} from '@mui/material';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  TrendingUp as CreditIcon,
  TrendingDown as DebitIcon,
  ExpandMore as ExpandMoreIcon,
  ChevronRight as ChevronRightIcon,
} from '@mui/icons-material';
import dayjs from 'dayjs';

interface TransactionCardProps {
  transaction: any;
  onEdit: () => void;
  onDelete: () => void;
  formatCurrency: (amount: number) => string;
  getCategoryName: (id: string) => string;
  getCategoryColor: (id: string) => string;
  getAccountName: (id: string) => string;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
}

const TransactionCard: React.FC<TransactionCardProps> = ({
  transaction,
  onEdit,
  onDelete,
  formatCurrency,
  getCategoryName,
  getCategoryColor,
  getAccountName,
  isExpanded = false,
  onToggleExpand,
}) => {
  const hasSplits = transaction.splits && transaction.splits.length > 1;

  return (
    <Card
      sx={{
        mb: 1,
        '&:active': {
          bgcolor: 'action.selected',
        },
      }}
    >
      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
        {/* Main content */}
        <Box display="flex" justifyContent="space-between" alignItems="flex-start">
          <Box flex={1}>
            {/* Date & Type */}
            <Box display="flex" alignItems="center" gap={1} mb={0.5}>
              <Chip
                icon={transaction.type === 'credit' ? <CreditIcon /> : <DebitIcon />}
                label={transaction.type === 'credit' ? 'Credit' : 'Debit'}
                color={transaction.type === 'credit' ? 'success' : 'error'}
                size="small"
                sx={{ height: 24 }}
              />
              <Typography variant="caption" color="text.secondary">
                {dayjs(transaction.date).format('MMM DD, YYYY')}
              </Typography>
            </Box>

            {/* Description */}
            <Typography variant="body1" fontWeight="medium" gutterBottom>
              {transaction.description}
            </Typography>

            {/* Merchant & Account */}
            <Typography variant="caption" color="text.secondary" display="block">
              {transaction.merchantName && `${transaction.merchantName} • `}
              {getAccountName(transaction.accountId)}
            </Typography>

            {/* Categories */}
            {hasSplits ? (
              <Box display="flex" gap={0.5} flexWrap="wrap" mt={1}>
                {(transaction.splits || []).slice(0, 2).map((split: any, idx: number) => (
                  <Chip
                    key={idx}
                    label={getCategoryName(split.categoryId)}
                    size="small"
                    sx={{
                      backgroundColor: `${getCategoryColor(split.categoryId)}20`,
                      color: getCategoryColor(split.categoryId),
                      height: 24,
                    }}
                  />
                ))}
                {(transaction.splits || []).length > 2 && (
                  <Chip
                    label={`+${(transaction.splits || []).length - 2} more`}
                    size="small"
                    sx={{ height: 24 }}
                  />
                )}
              </Box>
            ) : (
              <Box mt={1}>
                <Chip
                  label={getCategoryName(transaction.splits?.[0]?.categoryId)}
                  size="small"
                  sx={{
                    backgroundColor: `${getCategoryColor(transaction.splits?.[0]?.categoryId)}20`,
                    color: getCategoryColor(transaction.splits?.[0]?.categoryId),
                    height: 24,
                  }}
                />
              </Box>
            )}

            {/* Tags */}
            {transaction.splits?.[0]?.tags && transaction.splits[0].tags.length > 0 && (
              <Box display="flex" gap={0.5} flexWrap="wrap" mt={1}>
                {transaction.splits[0].tags.slice(0, 3).map((tagId: string, idx: number) => (
                  <Chip
                    key={idx}
                    label={tagId}
                    size="small"
                    variant="outlined"
                    sx={{ height: 20, fontSize: '0.7rem' }}
                  />
                ))}
              </Box>
            )}
          </Box>

          {/* Amount & Actions */}
          <Box display="flex" flexDirection="column" alignItems="flex-end" gap={1}>
            <Typography
              variant="h6"
              fontWeight="bold"
              color={transaction.type === 'credit' ? 'success.main' : 'error.main'}
            >
              {transaction.type === 'credit' ? '+' : '-'}
              {formatCurrency(transaction.amount)}
            </Typography>

            <Box display="flex" gap={0.5}>
              {hasSplits && onToggleExpand && (
                <IconButton size="small" onClick={onToggleExpand}>
                  {isExpanded ? <ExpandMoreIcon /> : <ChevronRightIcon />}
                </IconButton>
              )}
              <IconButton size="small" onClick={onEdit} sx={{ minWidth: 44, minHeight: 44 }}>
                <EditIcon fontSize="small" />
              </IconButton>
              <IconButton
                size="small"
                color="error"
                onClick={onDelete}
                sx={{ minWidth: 44, minHeight: 44 }}
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Box>
          </Box>
        </Box>

        {/* Expanded Split Details */}
        {hasSplits && (
          <Collapse in={isExpanded}>
            <Divider sx={{ my: 2 }} />
            <Typography variant="subtitle2" gutterBottom fontWeight="bold">
              Split Details
            </Typography>
            {(transaction.splits || []).map((split: any, idx: number) => (
              <Box
                key={idx}
                display="flex"
                justifyContent="space-between"
                alignItems="center"
                py={1}
                borderBottom={idx < transaction.splits.length - 1 ? '1px solid' : 'none'}
                borderColor="divider"
              >
                <Box>
                  <Chip
                    label={getCategoryName(split.categoryId)}
                    size="small"
                    sx={{
                      backgroundColor: `${getCategoryColor(split.categoryId)}20`,
                      color: getCategoryColor(split.categoryId),
                      height: 24,
                      mb: 0.5,
                    }}
                  />
                  {split.notes && (
                    <Typography variant="caption" display="block" color="text.secondary">
                      {split.notes}
                    </Typography>
                  )}
                </Box>
                <Typography variant="body2" fontWeight="medium">
                  {formatCurrency(split.amount)}
                </Typography>
              </Box>
            ))}
          </Collapse>
        )}
      </CardContent>
    </Card>
  );
};

export default React.memo(TransactionCard);
