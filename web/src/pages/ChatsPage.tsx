import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getConversations,
  getConversation,
  sendMessage,
  editMessage,
  deleteMessage,
  markAsRead,
  getDisplayName,
  formatRelativeTime,
  formatChatCurrency,
  searchUserByEmail,
} from '../services/conversationService';
import { useAccounts, useLabels, useTags, useCreateTag, useCreateTransaction } from '../hooks';
import { TransactionForm } from '../components/TransactionForm';
import { useAuth } from '../context/AuthContext';
import { logger } from '../services/logger';
import type { CreateTransactionRequest, UpdateTransactionRequest } from '../types/transactions';
import type {
  ConversationSummary,
  ConversationDetailResponse,
  ConversationMessage,
  UserSearchResult,
} from '../types/conversations';

// Time limits for message actions (in minutes)
const EDIT_TIME_LIMIT_MINUTES = 15;
const DELETE_TIME_LIMIT_MINUTES = 60;

// Helper to check if a message can still be edited
const canEditMessage = (msg: ConversationMessage): boolean => {
  if (!msg.isFromMe || msg.type !== 'Text' || msg.isDeleted) return false;
  const createdAt = new Date(msg.createdAt);
  const minutesElapsed = (Date.now() - createdAt.getTime()) / (1000 * 60);
  return minutesElapsed <= EDIT_TIME_LIMIT_MINUTES;
};

// Helper to check if a message can still be deleted
const canDeleteMessage = (msg: ConversationMessage): boolean => {
  if (!msg.isFromMe || msg.isDeleted) return false;
  const createdAt = new Date(msg.createdAt);
  const minutesElapsed = (Date.now() - createdAt.getTime()) / (1000 * 60);
  return minutesElapsed <= DELETE_TIME_LIMIT_MINUTES;
};

export default function ChatsPage() {
  // Auth context for current user
  const { user } = useAuth();
  
  // Navigation
  const navigate = useNavigate();
  
  // React Query hooks for data
  const { data: accounts = [] } = useAccounts();
  const { data: allLabels = [] } = useLabels();
  const { data: tags = [] } = useTags();
  const createTagMutation = useCreateTag();
  const createTransactionMutation = useCreateTransaction();
  
  // Filter to only Category labels (not Folders)
  const labels = useMemo(() => allLabels.filter(l => l.type === 'Category'), [allLabels]);
  
  // State
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<ConversationDetailResponse | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [messageInput, setMessageInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [replyTo, setReplyTo] = useState<ConversationMessage | null>(null);
  
  // Message menu state - store the message and position
  const [menuMessage, setMenuMessage] = useState<ConversationMessage | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ x: number; y: number; buttonTop: number } | null>(null);
  
  // Edit mode state
  const [editingMessage, setEditingMessage] = useState<ConversationMessage | null>(null);
  const [editInput, setEditInput] = useState('');
  
  // Scroll state
  const [showScrollButton, setShowScrollButton] = useState(false);
  
  // Search in conversation state
  const [showSearchBar, setShowSearchBar] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<string[]>([]); // message IDs
  const [currentSearchIndex, setCurrentSearchIndex] = useState(0);
  
  // Conversation list filter
  const [conversationFilter, setConversationFilter] = useState('');
  
  // Sidebar resize state
  const [sidebarWidth, setSidebarWidth] = useState(320); // Default 320px (w-80)
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const minWidth = 280;
  const maxWidth = 500;
  
  // Handle sidebar resize
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing || !sidebarRef.current) return;
      
      // Get the sidebar's left position to calculate proper width
      const sidebarRect = sidebarRef.current.getBoundingClientRect();
      const newWidth = e.clientX - sidebarRect.left;
      
      // Clamp to min/max
      const clampedWidth = Math.min(maxWidth, Math.max(minWidth, newWidth));
      setSidebarWidth(clampedWidth);
    };
    
    const handleMouseUp = () => {
      setIsResizing(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    
    if (isResizing) {
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);
  
  // New conversation modal
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [searchEmail, setSearchEmail] = useState('');
  const [searchResult, setSearchResult] = useState<UserSearchResult | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  
  // Transaction form modal state
  const [showTransactionForm, setShowTransactionForm] = useState(false);
  const [transactionFormError, setTransactionFormError] = useState<string | null>(null);
  
  // Determine if this is a self-chat (for Transfer option)
  const isSelfChat = user?.email === selectedConversation?.counterpartyEmail;

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // Handle scroll to detect if user scrolled up
  const handleScroll = useCallback(() => {
    if (messagesContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
      // Only show button if there's enough content to scroll AND user has scrolled up
      const hasEnoughContent = scrollHeight > clientHeight + 50;
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 150;
      setShowScrollButton(hasEnoughContent && !isNearBottom);
    }
  }, []);

  // Scroll to bottom function
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  // Load initial conversations
  useEffect(() => {
    const loadConversations = async () => {
      try {
        const convosResponse = await getConversations();
        setConversations(convosResponse.conversations);
      } catch (error) {
        logger.error('Failed to load conversations:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadConversations();
  }, []);

  // Load conversation when selected
  const loadConversation = useCallback(async (userId: string) => {
    setIsLoadingMessages(true);
    setSelectedUserId(userId);
    try {
      const convo = await getConversation(userId);
      setSelectedConversation(convo);
      // Mark as read
      await markAsRead(userId);
      // Update unread count in list
      setConversations(prev => prev.map(c => 
        c.counterpartyUserId === userId ? { ...c, unreadCount: 0 } : c
      ));
    } catch (error) {
      logger.error('Failed to load conversation:', error);
    } finally {
      setIsLoadingMessages(false);
    }
  }, []);

  // Scroll to bottom when conversation loads or messages change
  useEffect(() => {
    if (selectedConversation?.messages && selectedConversation.messages.length > 0) {
      // Use setTimeout to ensure DOM is fully rendered before scrolling
      const timeoutId = setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'instant' });
      }, 50);
      return () => clearTimeout(timeoutId);
    }
  }, [selectedConversation?.messages]);

  // Send message handler
  const handleSendMessage = async () => {
    if (!messageInput.trim() || !selectedUserId || isSending) return;
    
    setIsSending(true);
    try {
      await sendMessage(selectedUserId, {
        content: messageInput.trim(),
        replyToMessageId: replyTo?.id,
      });
      setMessageInput('');
      setReplyTo(null);
      // Reload conversation
      await loadConversation(selectedUserId);
      // Smooth scroll after sending
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
      // Reload conversations list
      const convosResponse = await getConversations();
      setConversations(convosResponse.conversations);
    } catch (error) {
      logger.error('Failed to send message:', error);
    } finally {
      setIsSending(false);
    }
  };

  // Edit message handler
  const handleEditMessage = async () => {
    if (!editingMessage || !editInput.trim() || !selectedUserId) return;
    
    try {
      await editMessage(editingMessage.id, { content: editInput.trim() });
      setEditingMessage(null);
      setEditInput('');
      // Reload conversation
      await loadConversation(selectedUserId);
    } catch (error) {
      logger.error('Failed to edit message:', error);
    }
  };

  // Delete message handler
  const handleDeleteMessage = async (messageId: string) => {
    if (!selectedUserId) return;
    
    try {
      await deleteMessage(messageId);
      // Reload conversation
      await loadConversation(selectedUserId);
      // Reload conversations list (last message preview might change)
      const convosResponse = await getConversations();
      setConversations(convosResponse.conversations);
    } catch (error) {
      logger.error('Failed to delete message:', error);
    }
  };

  // Start editing a message
  const startEditing = (msg: ConversationMessage) => {
    setEditingMessage(msg);
    setEditInput(msg.content || '');
    setMenuMessage(null);
    setMenuPosition(null);
  };

  // Cancel editing
  const cancelEditing = () => {
    setEditingMessage(null);
    setEditInput('');
  };

  // Search within conversation
  const handleSearchInConversation = useCallback((query: string) => {
    setSearchQuery(query);
    if (!query.trim() || !selectedConversation) {
      setSearchResults([]);
      setCurrentSearchIndex(0);
      return;
    }
    
    const lowerQuery = query.toLowerCase();
    const matchingIds = selectedConversation.messages
      .filter(msg => msg.content?.toLowerCase().includes(lowerQuery))
      .map(msg => msg.id);
    
    setSearchResults(matchingIds);
    setCurrentSearchIndex(0);
    
    // Scroll to first result
    if (matchingIds.length > 0) {
      const element = document.getElementById(`msg-${matchingIds[0]}`);
      element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [selectedConversation]);

  // Navigate search results
  const navigateSearchResult = (direction: 'prev' | 'next') => {
    if (searchResults.length === 0) return;
    
    let newIndex = currentSearchIndex;
    if (direction === 'next') {
      newIndex = (currentSearchIndex + 1) % searchResults.length;
    } else {
      newIndex = (currentSearchIndex - 1 + searchResults.length) % searchResults.length;
    }
    
    setCurrentSearchIndex(newIndex);
    const element = document.getElementById(`msg-${searchResults[newIndex]}`);
    element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  // Close search bar
  const closeSearchBar = () => {
    setShowSearchBar(false);
    setSearchQuery('');
    setSearchResults([]);
    setCurrentSearchIndex(0);
  };

  // Search user handler
  const handleSearchUser = async () => {
    if (!searchEmail.trim()) return;
    
    setIsSearching(true);
    setSearchError('');
    setSearchResult(null);
    
    try {
      const result = await searchUserByEmail(searchEmail.trim());
      if (result?.user) {
        setSearchResult(result.user);
      } else {
        setSearchError('User not found');
      }
    } catch {
      setSearchError('Failed to search user');
    } finally {
      setIsSearching(false);
    }
  };

  // Start conversation with searched user
  const handleStartConversation = async () => {
    if (!searchResult) return;
    
    setShowNewChatModal(false);
    setSearchEmail('');
    setSearchResult(null);
    
    // Check if conversation already exists
    const existing = conversations.find(c => c.counterpartyUserId === searchResult.userId);
    if (existing) {
      await loadConversation(existing.counterpartyUserId);
    } else {
      // Create new conversation by selecting user
      setSelectedUserId(searchResult.userId);
      setSelectedConversation({
        counterpartyUserId: searchResult.userId,
        counterpartyName: searchResult.name,
        counterpartyEmail: searchResult.email,
        totalSent: 0,
        totalReceived: 0,
        messages: [],
        totalCount: 0,
        hasMore: false,
      });
    }
  };

  // Handle transaction form submit
  const handleTransactionSubmit = async (data: CreateTransactionRequest | UpdateTransactionRequest) => {
    if (!selectedConversation) return;
    
    setTransactionFormError(null);
    
    try {
      // Create the transaction using React Query mutation
      const transaction = await createTransactionMutation.mutateAsync(data as CreateTransactionRequest);
      
      // Refresh the conversation to show the new transaction
      await loadConversation(selectedConversation.counterpartyUserId);
      
      // Update conversation list preview
      const isSend = transaction.type === 'Send';
      const actionWord = isSend ? 'Sent' : 'Received';
      setConversations(prev => {
        const existing = prev.find(c => c.counterpartyUserId === selectedConversation.counterpartyUserId);
        if (existing) {
          return prev.map(c => 
            c.counterpartyUserId === selectedConversation.counterpartyUserId 
              ? { 
                  ...c, 
                  lastActivityAt: new Date().toISOString(),
                  lastMessagePreview: `${actionWord} ${formatChatCurrency(transaction.amount, transaction.currency || 'INR')}`,
                  lastMessageType: 'Transaction',
                  totalSent: (c.totalSent || 0) + (isSend ? transaction.amount : 0),
                  totalReceived: (c.totalReceived || 0) + (isSend ? 0 : transaction.amount),
                }
              : c
          ).sort((a, b) => new Date(b.lastActivityAt).getTime() - new Date(a.lastActivityAt).getTime());
        }
        return prev;
      });
      
      // Close form
      setShowTransactionForm(false);
      
      // Scroll to bottom to show the new message
      setTimeout(scrollToBottom, 100);
    } catch (error) {
      logger.error('Failed to create transaction:', error);
      setTransactionFormError(error instanceof Error ? error.message : 'Failed to create transaction');
    }
  };

  // Format date for date separator
  const formatDateSeparator = (dateString: string): string => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const isToday = date.toDateString() === today.toDateString();
    const isYesterday = date.toDateString() === yesterday.toDateString();
    
    if (isToday) return 'Today';
    if (isYesterday) return 'Yesterday';
    
    return date.toLocaleDateString(undefined, { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  // Check if two dates are on different days
  const isDifferentDay = (date1: string, date2: string): boolean => {
    const d1 = new Date(date1).toDateString();
    const d2 = new Date(date2).toDateString();
    return d1 !== d2;
  };

  // Render conversation list item
  const renderConversationItem = (convo: ConversationSummary) => {
    const isSelected = selectedUserId === convo.counterpartyUserId;
    const displayName = getDisplayName(convo.counterpartyName, convo.counterpartyEmail);
    
    return (
      <button
        key={convo.counterpartyUserId}
        onClick={() => loadConversation(convo.counterpartyUserId)}
        className={`w-full p-3 flex items-start gap-3 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left ${
          isSelected ? 'bg-blue-50 dark:bg-blue-900/20 border-r-2 border-blue-500' : ''
        }`}
      >
        {/* Avatar */}
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold text-lg flex-shrink-0">
          {displayName.charAt(0).toUpperCase()}
        </div>
        
        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium text-gray-900 dark:text-gray-100 truncate">
              {displayName}
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">
              {formatRelativeTime(convo.lastActivityAt)}
            </span>
          </div>
          
          <p className="text-sm text-gray-600 dark:text-gray-400 truncate mt-0.5">
            {convo.lastMessagePreview || 'No messages yet'}
          </p>
          
          {/* Amount summary */}
          <div className="flex items-center gap-3 mt-1.5">
            {(convo.totalSent ?? 0) > 0 && (
              <span className="text-xs font-medium text-red-600 dark:text-red-400 flex items-center gap-0.5">
                <span>↑</span>
                {formatChatCurrency(convo.totalSent!, convo.primaryCurrency)}
              </span>
            )}
            {(convo.totalReceived ?? 0) > 0 && (
              <span className="text-xs font-medium text-green-600 dark:text-green-400 flex items-center gap-0.5">
                <span>↓</span>
                {formatChatCurrency(convo.totalReceived!, convo.primaryCurrency)}
              </span>
            )}
          </div>
        </div>
        
        {/* Unread badge */}
        {convo.unreadCount > 0 && (
          <span className="w-5 h-5 rounded-full bg-blue-500 text-white text-xs font-medium flex items-center justify-center flex-shrink-0">
            {convo.unreadCount > 9 ? '9+' : convo.unreadCount}
          </span>
        )}
      </button>
    );
  };

  // Render message
  const renderMessage = (msg: ConversationMessage, showTime: boolean = true) => {
    const isMine = msg.isFromMe;
    const isCurrentSearchResult = searchResults.length > 0 && searchResults[currentSearchIndex] === msg.id;
    
    // Transaction message
    if (msg.type === 'Transaction' && msg.transaction) {
      const tx = msg.transaction;
      const isSent = tx.transactionType === 'Send';
      
      return (
        <div key={msg.id} id={`msg-${msg.id}`} className={`flex ${isSent ? 'justify-end' : 'justify-start'} mb-3 group transition-all duration-300`}>
          <div className="relative">
            <div 
              className={`max-w-xs rounded-2xl p-4 ${
                isSent 
                  ? 'bg-gradient-to-br from-red-500 to-red-600 text-white' 
                  : 'bg-gradient-to-br from-green-500 to-green-600 text-white'
              }`}
            >
              {/* Menu trigger */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  const rect = e.currentTarget.getBoundingClientRect();
                  setMenuPosition({ x: rect.left, y: rect.bottom, buttonTop: rect.top });
                  setMenuMessage(msg);
                }}
                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-white/20 text-white/70 hover:text-white transition-opacity"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              
              {/* Status badge */}
              <div className="flex items-center justify-center gap-1 mb-2">
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                  isSent ? 'bg-red-400/30' : 'bg-green-400/30'
                }`}>
                  {isSent ? '↑ Sent' : '↓ Received'}
                </span>
              </div>
              
              {/* Amount */}
              <div className="text-center">
                <div className="text-2xl font-bold">
                  {formatChatCurrency(tx.amount, tx.currency)}
                </div>
                {tx.accountName && (
                  <div className="text-sm opacity-80 mt-1">
                    {tx.accountName}
                  </div>
                )}
                {tx.notes && (
                  <div className="text-sm opacity-80 mt-1 italic">
                    "{tx.notes}"
                  </div>
                )}
                {showTime && (
                  <div className="text-xs opacity-60 mt-2">
                    {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      );
    }
    
    // Deleted message
    if (msg.isDeleted) {
      return (
        <div key={msg.id} id={`msg-${msg.id}`} className={`flex ${isMine ? 'justify-end' : 'justify-start'} mb-3`}>
          <div className="px-4 py-2 rounded-2xl bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 italic text-sm">
            This message was deleted
          </div>
        </div>
      );
    }
    
    // Helper to scroll to replied message
    const scrollToMessage = (messageId: string) => {
      const element = document.getElementById(`msg-${messageId}`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // Highlight the message briefly with rounded gray tint and smooth fade
        element.classList.add('rounded-2xl', 'transition-colors', 'duration-500');
        element.classList.add('bg-gray-200', 'dark:bg-gray-700');
        setTimeout(() => {
          element.classList.remove('bg-gray-200', 'dark:bg-gray-700');
          // Remove transition classes after fade completes
          setTimeout(() => {
            element.classList.remove('rounded-2xl', 'transition-colors', 'duration-500');
          }, 500);
        }, 1000);
      }
    };
    
    // Long press handlers for mobile
    let longPressTimer: ReturnType<typeof setTimeout> | null = null;
    
    const handleTouchStart = (e: React.TouchEvent) => {
      longPressTimer = setTimeout(() => {
        const rect = (e.target as HTMLElement).getBoundingClientRect();
        setMenuPosition({ x: rect.left, y: rect.bottom, buttonTop: rect.top });
        setMenuMessage(msg);
      }, 500); // 500ms for long press
    };
    
    const handleTouchEnd = () => {
      if (longPressTimer) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
      }
    };
    
    const handleTouchMove = () => {
      if (longPressTimer) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
      }
    };
    
    // Text message
    return (
      <div key={msg.id} id={`msg-${msg.id}`} className={`flex ${isMine ? 'justify-end' : 'justify-start'} mb-3 group transition-all duration-300`}>
        <div className={`flex flex-col max-w-xs ${isMine ? 'items-end' : 'items-start'}`}>
          {/* Reply reference - Instagram style */}
          {msg.replyTo && (
            <div className={`flex flex-col ${isMine ? 'items-end' : 'items-start'} mb-1`}>
              {/* Label */}
              <span className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                {msg.replyTo.senderUserId === (selectedConversation?.counterpartyUserId) 
                  ? `Replied to ${selectedConversation?.counterpartyName || 'them'}`
                  : 'You replied to yourself'}
              </span>
              {/* Original message bubble - lighter shade */}
              <button
                onClick={() => scrollToMessage(msg.replyTo!.messageId)}
                className={`px-3 py-2 rounded-2xl cursor-pointer hover:opacity-90 transition-opacity ${
                  isMine 
                    ? 'bg-blue-300 text-blue-900 dark:bg-blue-400/50 dark:text-white' 
                    : 'bg-indigo-100 dark:bg-indigo-800/40 text-indigo-700 dark:text-indigo-200'
                }`}
              >
                <p className="text-sm line-clamp-2">
                  {msg.replyTo.contentPreview || 'Message'}
                </p>
              </button>
            </div>
          )}
          
          {/* Edited indicator - above message */}
          {msg.isEdited && (
            <span className="text-xs text-gray-500 dark:text-gray-400 mb-1">Edited</span>
          )}
          
          {/* Message bubble with dropdown */}
          <div className="relative">
            <div 
              className={`px-4 py-2 rounded-2xl select-none touch-none ${
                isMine 
                  ? 'bg-blue-500 text-white rounded-br-md' 
                  : 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-900 dark:text-indigo-100 rounded-bl-md'
              }`}
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
              onTouchMove={handleTouchMove}
            >
              {/* Menu trigger - top right corner */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  const rect = e.currentTarget.getBoundingClientRect();
                  setMenuPosition({ x: rect.left, y: rect.bottom, buttonTop: rect.top });
                  setMenuMessage(msg);
                }}
                className={`absolute top-1 ${isMine ? 'right-1' : 'right-1'} opacity-0 group-hover:opacity-100 p-1 rounded transition-opacity ${
                  isMine 
                    ? 'hover:bg-blue-400/50 text-white/70 hover:text-white' 
                    : 'hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
                }`}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              
              <p className="text-sm whitespace-pre-wrap break-words pr-6">
                {searchQuery && msg.content?.toLowerCase().includes(searchQuery.toLowerCase()) ? (
                  // Highlight search matches - orange for current, yellow for others
                  msg.content.split(new RegExp(`(${searchQuery})`, 'gi')).map((part, i) => 
                    part.toLowerCase() === searchQuery.toLowerCase() ? (
                      <mark key={i} className={`${isCurrentSearchResult ? 'bg-orange-400 dark:bg-orange-500' : 'bg-yellow-300 dark:bg-yellow-600'} text-inherit rounded px-0.5`}>{part}</mark>
                    ) : part
                  )
                ) : msg.content}
              </p>
              {showTime && (
                <div className={`flex items-center justify-end gap-1.5 mt-1 ${
                  isMine ? 'text-blue-100' : 'text-gray-400 dark:text-gray-500'
                }`}>
                  <span className="text-xs">
                    {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="-m-4 sm:-m-6 lg:-m-8 flex h-[calc(100vh-4rem)] bg-white dark:bg-gray-900">
      {/* Conversations list */}
      <div 
        ref={sidebarRef}
        className={`flex flex-col border-r border-gray-200 dark:border-gray-700 ${
          selectedUserId ? 'hidden md:flex' : 'flex'
        }`}
        style={{ width: `${sidebarWidth}px`, minWidth: `${minWidth}px`, maxWidth: `${maxWidth}px` }}
      >
        {/* Header */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Chats</h1>
          <button
            onClick={() => setShowNewChatModal(true)}
            className="p-2 text-gray-500 hover:text-blue-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            title="New Chat"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>
        
        {/* Search conversations */}
        <div className="p-3 border-b border-gray-200 dark:border-gray-700">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={conversationFilter}
              onChange={(e) => setConversationFilter(e.target.value)}
              placeholder="Search by name or email..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            {conversationFilter && (
              <button
                onClick={() => setConversationFilter('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>
        
        {/* Conversations */}
        <div className="flex-1 overflow-y-auto">
          {conversations.length === 0 ? (
            <div className="p-8 text-center text-gray-500 dark:text-gray-400">
              <svg className="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} 
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <p className="font-medium">No conversations yet</p>
              <p className="text-sm mt-1">Start a new chat or make a transaction</p>
            </div>
          ) : (
            conversations
              .filter(conv => {
                if (!conversationFilter.trim()) return true;
                const filter = conversationFilter.toLowerCase();
                const name = (conv.counterpartyName || '').toLowerCase();
                const email = (conv.counterpartyEmail || '').toLowerCase();
                return name.includes(filter) || email.includes(filter);
              })
              .map(renderConversationItem)
          )}
          {conversationFilter && conversations.filter(conv => {
            const filter = conversationFilter.toLowerCase();
            const name = (conv.counterpartyName || '').toLowerCase();
            const email = (conv.counterpartyEmail || '').toLowerCase();
            return name.includes(filter) || email.includes(filter);
          }).length === 0 && (
            <div className="p-4 text-center text-gray-500 dark:text-gray-400 text-sm">
              No conversations match "{conversationFilter}"
            </div>
          )}
        </div>
      </div>
      
      {/* Resize handle */}
      <div
        className={`hidden md:flex w-3 items-center justify-center cursor-col-resize flex-shrink-0 group hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors ${isResizing ? 'bg-blue-100 dark:bg-blue-900/30' : 'bg-transparent'}`}
        onMouseDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsResizing(true);
        }}
        onDoubleClick={() => setSidebarWidth(320)} // Reset to default on double-click
        title="Drag to resize, double-click to reset"
      >
        <div className={`w-1 h-10 rounded-full transition-colors ${isResizing ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600 group-hover:bg-blue-400'}`} />
      </div>
      
      {/* Chat area */}
      <div className={`flex-1 flex flex-col ${selectedUserId ? 'flex' : 'hidden md:flex'}`}>
        {selectedConversation ? (
          <>
            {/* Chat header */}
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center gap-3">
              {/* Back button (mobile) */}
              <button
                onClick={() => {
                  setSelectedUserId(null);
                  setSelectedConversation(null);
                }}
                className="md:hidden p-1 -ml-1 text-gray-500 hover:text-gray-700 dark:text-gray-400"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              
              {/* Avatar */}
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold">
                {getDisplayName(selectedConversation.counterpartyName, selectedConversation.counterpartyEmail).charAt(0).toUpperCase()}
              </div>
              
              {/* Info */}
              <div className="flex-1 min-w-0">
                <h2 className="font-semibold text-gray-900 dark:text-gray-100 truncate">
                  {getDisplayName(selectedConversation.counterpartyName, selectedConversation.counterpartyEmail)}
                </h2>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                  {selectedConversation.counterpartyEmail}
                </p>
              </div>
              
              {/* Totals */}
              <div className="hidden sm:flex items-center gap-4 text-sm">
                <div className="text-center">
                  <div className="text-xs text-gray-500 dark:text-gray-400">Sent</div>
                  <div className="font-semibold text-red-600 dark:text-red-400">
                    ₹{selectedConversation.totalSent.toLocaleString()}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-xs text-gray-500 dark:text-gray-400">Received</div>
                  <div className="font-semibold text-green-600 dark:text-green-400">
                    ₹{selectedConversation.totalReceived.toLocaleString()}
                  </div>
                </div>
              </div>
              
              {/* Search button */}
              <button
                onClick={() => setShowSearchBar(!showSearchBar)}
                className={`p-2 rounded-full transition-colors ${
                  showSearchBar 
                    ? 'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400' 
                    : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
                title="Search messages"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </button>
            </div>
            
            {/* Search bar */}
            {showSearchBar && (
              <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 flex items-center gap-2">
                <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => handleSearchInConversation(e.target.value)}
                  placeholder="Search in conversation..."
                  autoFocus
                  className="flex-1 px-2 py-1 bg-transparent text-gray-900 dark:text-gray-100 focus:outline-none"
                />
                {searchResults.length > 0 && (
                  <div className="flex items-center gap-1 text-sm text-gray-500">
                    <span>{currentSearchIndex + 1}/{searchResults.length}</span>
                    <button
                      onClick={() => navigateSearchResult('prev')}
                      className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                      </svg>
                    </button>
                    <button
                      onClick={() => navigateSearchResult('next')}
                      className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  </div>
                )}
                <button
                  onClick={closeSearchBar}
                  className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            )}
            
            {/* Messages container wrapper for scroll button positioning */}
            <div className="flex-1 relative overflow-hidden">
              {/* Messages */}
              <div 
                ref={messagesContainerRef}
                onScroll={handleScroll}
                className="h-full overflow-y-auto p-4 bg-gray-50 dark:bg-gray-800/50"
              >
              {isLoadingMessages ? (
                <div className="flex items-center justify-center h-full">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
                </div>
              ) : selectedConversation.messages.length === 0 ? (
                <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
                  <p>No messages yet. Start the conversation!</p>
                </div>
              ) : (
                <>
                  {selectedConversation.messages.map((msg, index) => {
                    const prevMsg = index > 0 ? selectedConversation.messages[index - 1] : null;
                    const nextMsg = index < selectedConversation.messages.length - 1 
                      ? selectedConversation.messages[index + 1] : null;
                    
                    const showDateSeparator = index === 0 || 
                      isDifferentDay(prevMsg!.createdAt, msg.createdAt);
                    
                    // Show time if:
                    // - Last message in the conversation
                    // - Next message is from different sender
                    // - More than 5 minutes gap with next message
                    // - Different day than next message
                    const showTime = !nextMsg || 
                      nextMsg.isFromMe !== msg.isFromMe ||
                      isDifferentDay(msg.createdAt, nextMsg.createdAt) ||
                      (new Date(nextMsg.createdAt).getTime() - new Date(msg.createdAt).getTime()) > 5 * 60 * 1000;
                    
                    return (
                      <div key={msg.id}>
                        {showDateSeparator && (
                          <div className="flex items-center justify-center my-4">
                            <div className="px-3 py-1 bg-gray-200 dark:bg-gray-700 rounded-full text-xs text-gray-600 dark:text-gray-300 font-medium">
                              {formatDateSeparator(msg.createdAt)}
                            </div>
                          </div>
                        )}
                        {renderMessage(msg, showTime)}
                      </div>
                    );
                  })}
                  {/* Seen indicator - Instagram style, only shows once below last message if it's mine and read */}
                  {(() => {
                    const lastMsg = selectedConversation.messages[selectedConversation.messages.length - 1];
                    if (lastMsg?.isFromMe && lastMsg?.status === 'Read') {
                      return (
                        <div className="flex justify-end pr-2 mt-1">
                          <span className="text-xs text-gray-500 dark:text-gray-400">Seen</span>
                        </div>
                      );
                    }
                    return null;
                  })()}
                  <div ref={messagesEndRef} />
                </>
              )}
            </div>
              
            {/* Scroll to bottom button - positioned outside scrollable area */}
            {showScrollButton && (
              <button
                onClick={scrollToBottom}
                className="absolute bottom-4 right-4 p-3 bg-white dark:bg-gray-700 rounded-full shadow-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors z-10"
              >
                <svg className="w-5 h-5 text-gray-600 dark:text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                </svg>
              </button>
            )}
          </div>
            
            {/* Input area */}
            <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
              {/* Reply preview */}
              {replyTo && (
                <div className="flex items-center gap-2 mb-2 p-2 bg-gray-100 dark:bg-gray-800 rounded-lg border-l-4 border-blue-500">
                  <svg className="w-4 h-4 text-blue-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
                  </svg>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-blue-600 dark:text-blue-400">
                      Replying to {replyTo.isFromMe ? 'yourself' : (selectedConversation?.counterpartyName || 'User')}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400 truncate">
                      {replyTo.type === 'Transaction' && replyTo.transaction
                        ? `${replyTo.transaction.transactionType === 'Send' ? 'Sent' : 'Received'} ${formatChatCurrency(replyTo.transaction.amount, replyTo.transaction.currency)}`
                        : (replyTo.content || 'Message')}
                    </div>
                  </div>
                  <button
                    onClick={() => setReplyTo(null)}
                    className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              )}
              
              {/* Edit mode indicator */}
              {editingMessage && (
                <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 dark:bg-blue-900/30 border-l-4 border-blue-500 mb-2 rounded-r">
                  <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  <span className="flex-1 text-sm text-blue-800 dark:text-blue-200 truncate">
                    Editing: {editingMessage.content?.substring(0, 50)}...
                  </span>
                  <button
                    onClick={cancelEditing}
                    className="p-1.5 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200 hover:bg-blue-100 dark:hover:bg-blue-800/30 rounded-full transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              )}
              
              <div className="flex items-center gap-2">
                {editingMessage ? (
                  <>
                    <input
                      type="text"
                      value={editInput}
                      onChange={(e) => setEditInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) handleEditMessage();
                        if (e.key === 'Escape') cancelEditing();
                      }}
                      autoFocus
                      placeholder="Edit message..."
                      className="flex-1 px-4 py-2 border border-blue-400 dark:border-blue-600 rounded-full bg-blue-50 dark:bg-blue-900/20 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <button
                      onClick={handleEditMessage}
                      disabled={!editInput.trim()}
                      className="p-2 bg-blue-500 text-white rounded-full hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </button>
                  </>
                ) : (
                  <>
                    <input
                      type="text"
                      value={messageInput}
                      onChange={(e) => setMessageInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && messageInput.trim() && handleSendMessage()}
                      placeholder="Type a message..."
                      className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-full bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    {/* Show ₹ button when empty, send button when typing */}
                    {messageInput.trim() ? (
                      <button
                        onClick={handleSendMessage}
                        disabled={isSending}
                        className="p-2 bg-blue-500 text-white rounded-full hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                        </svg>
                      </button>
                    ) : (
                      <button
                        onClick={() => setShowTransactionForm(true)}
                        disabled={accounts.length === 0}
                        className="p-2 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-full hover:from-blue-600 hover:to-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                        title="New transaction"
                      >
                        <span className="w-5 h-5 flex items-center justify-center font-bold text-sm">₹</span>
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          </>
        ) : (
          /* No conversation selected */
          <div className="flex-1 flex items-center justify-center bg-gray-50 dark:bg-gray-800/50">
            <div className="text-center text-gray-500 dark:text-gray-400">
              <svg className="w-20 h-20 mx-auto mb-4 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} 
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <h3 className="text-lg font-medium mb-1">Select a conversation</h3>
              <p className="text-sm">Choose a conversation from the list to view messages</p>
            </div>
          </div>
        )}
      </div>
      
      {/* New Chat Modal */}
      {showNewChatModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md mx-4">
            {/* Header */}
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">New Chat</h3>
              <button
                onClick={() => {
                  setShowNewChatModal(false);
                  setSearchEmail('');
                  setSearchResult(null);
                  setSearchError('');
                }}
                className="p-1 text-gray-400 hover:text-gray-600"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            {/* Content */}
            <div className="p-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Search by email
              </label>
              <div className="flex gap-2">
                <input
                  type="email"
                  value={searchEmail}
                  onChange={(e) => setSearchEmail(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearchUser()}
                  placeholder="Enter email address"
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={handleSearchUser}
                  disabled={!searchEmail.trim() || isSearching}
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSearching ? '...' : 'Search'}
                </button>
              </div>
              
              {/* Error */}
              {searchError && (
                <p className="mt-2 text-sm text-red-500">{searchError}</p>
              )}
              
              {/* Search result */}
              {searchResult && (
                <div className="mt-4 p-3 border border-gray-200 dark:border-gray-700 rounded-lg flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold">
                    {(searchResult.name || searchResult.email).charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-gray-900 dark:text-gray-100">
                      {searchResult.name || 'No name'}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {searchResult.email}
                    </p>
                  </div>
                  <button
                    onClick={handleStartConversation}
                    className="px-3 py-1.5 bg-blue-500 text-white text-sm rounded-lg hover:bg-blue-600"
                  >
                    Chat
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Transaction Form Modal */}
      <TransactionForm
        isOpen={showTransactionForm}
        onClose={() => {
          setShowTransactionForm(false);
          setTransactionFormError(null);
        }}
        onSubmit={handleTransactionSubmit}
        editingTransaction={null}
        accounts={accounts}
        labels={labels}
        tags={tags}
        isLoading={createTransactionMutation.isPending}
        error={transactionFormError}
        // Chat context props
        hideRecipientField={true}
        showTransfer={isSelfChat}
        fixedCounterpartyEmail={selectedConversation?.counterpartyEmail}
        hidePayeeField={!isSelfChat}
        onCreateTag={async (name) => {
          try {
            const newTag = await createTagMutation.mutateAsync({ name });
            return newTag;
          } catch (error) {
            logger.error('Failed to create tag:', error);
            return null;
          }
        }}
      />

      {/* Message Actions Menu - attached to message */}
      {menuMessage && menuPosition && (() => {
        // Calculate menu height based on options (each option ~40px + padding)
        const optionCount = 1 + (menuMessage.type === 'Text' ? 1 : 0) + (menuMessage.type === 'Transaction' ? 1 : 0) + (menuMessage.isFromMe && menuMessage.type === 'Text' ? 1 : 0) + (menuMessage.isFromMe ? 1 : 0);
        const menuHeight = optionCount * 40 + 8;
        const spaceBelow = window.innerHeight - menuPosition.y;
        const spaceAbove = menuPosition.buttonTop;
        const openUpward = spaceBelow < menuHeight && spaceAbove > spaceBelow;
        
        return (
          <div 
            className="fixed inset-0 z-50"
            onClick={() => {
              setMenuMessage(null);
              setMenuPosition(null);
            }}
          >
            <div 
              className="absolute bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden min-w-[140px]"
              style={{ 
                ...(openUpward 
                  ? { bottom: window.innerHeight - menuPosition.buttonTop + 4 }
                  : { top: menuPosition.y + 4 }
                ),
                left: menuMessage.isFromMe ? 'auto' : menuPosition.x,
                right: menuMessage.isFromMe ? (window.innerWidth - menuPosition.x - 24) : 'auto',
              }}
              onClick={(e) => e.stopPropagation()}
            >
            {/* Reply */}
            <button
              onClick={() => {
                setReplyTo(menuMessage);
                setMenuMessage(null);
                setMenuPosition(null);
              }}
              className="w-full px-4 py-2.5 text-left text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-3"
            >
              <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
              </svg>
              <span>Reply</span>
            </button>
            
            {/* Copy */}
            {menuMessage.type === 'Text' && (
              <button
                onClick={() => {
                  navigator.clipboard.writeText(menuMessage.content || '');
                  setMenuMessage(null);
                  setMenuPosition(null);
                }}
                className="w-full px-4 py-2.5 text-left text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-3"
              >
                <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                <span>Copy</span>
              </button>
            )}
            
            {/* View in Transactions - only for transaction messages */}
            {menuMessage.type === 'Transaction' && menuMessage.transaction && (
              <button
                onClick={() => {
                  navigate(`/transactions?highlight=${menuMessage.transaction!.transactionId}`);
                  setMenuMessage(null);
                  setMenuPosition(null);
                }}
                className="w-full px-4 py-2.5 text-left text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-3"
              >
                <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                <span>View in Transactions</span>
              </button>
            )}
            
            {/* Edit - only for own text messages within 15 minutes */}
            {canEditMessage(menuMessage) && (
              <button
                onClick={() => startEditing(menuMessage)}
                className="w-full px-4 py-2.5 text-left text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-3"
              >
                <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                <span>Edit</span>
              </button>
            )}
            
            {/* Delete - only for own messages within 1 hour */}
            {canDeleteMessage(menuMessage) && (
              <button
                onClick={() => {
                  handleDeleteMessage(menuMessage.id);
                  setMenuMessage(null);
                  setMenuPosition(null);
                }}
                className="w-full px-4 py-2.5 text-left text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-3"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                <span>Delete</span>
              </button>
            )}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
