import { useState, useEffect, useCallback, useRef } from 'react';
import {
  getConversations,
  getConversation,
  sendMessage,
  markAsRead,
  getDisplayName,
  formatRelativeTime,
  formatChatCurrency,
} from '../services/conversationService';
import { getAccounts, type Account } from '../services/accountService';
import { getLabels } from '../services/labelService';
import type {
  ConversationSummary,
  ConversationDetailResponse,
  ConversationMessage,
} from '../types/conversations';
import type { Label } from '../types/labels';

// Icons
const ChevronLeftIcon = () => (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
  </svg>
);

const SendIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
      d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
  </svg>
);

const CurrencyIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
      d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

export default function ChatsPage() {
  // State
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<ConversationDetailResponse | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [labels, setLabels] = useState<Label[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Message input
  const [messageText, setMessageText] = useState('');
  const [isSending, setIsSending] = useState(false);
  
  // Send money modal
  const [showSendMoney, setShowSendMoney] = useState(false);
  
  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageInputRef = useRef<HTMLInputElement>(null);

  // Load conversations list
  const loadConversations = useCallback(async () => {
    try {
      const response = await getConversations();
      setConversations(response.conversations);
    } catch (err) {
      console.error('Failed to load conversations:', err);
      setError('Failed to load conversations');
    }
  }, []);

  // Load a specific conversation
  const loadConversation = useCallback(async (counterpartyUserId: string) => {
    try {
      setIsLoadingMessages(true);
      const response = await getConversation(counterpartyUserId, 50);
      setSelectedConversation(response);
      setSelectedUserId(counterpartyUserId);
      
      // Mark as read
      await markAsRead(counterpartyUserId);
      
      // Update unread count in list
      setConversations(prev => 
        prev.map(c => 
          c.counterpartyUserId === counterpartyUserId 
            ? { ...c, unreadCount: 0 }
            : c
        )
      );
    } catch (err) {
      console.error('Failed to load conversation:', err);
      setError('Failed to load conversation');
    } finally {
      setIsLoadingMessages(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      try {
        const [_, accountsData, labelsData] = await Promise.all([
          loadConversations(),
          getAccounts(),
          getLabels(),
        ]);
        setAccounts(accountsData);
        setLabels(labelsData.filter(l => l.type === 'Category'));
      } catch (err) {
        console.error('Failed to initialize:', err);
      } finally {
        setIsLoading(false);
      }
    };
    init();
  }, [loadConversations]);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (selectedConversation) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [selectedConversation]);

  // Focus input when conversation selected
  useEffect(() => {
    if (selectedConversation) {
      messageInputRef.current?.focus();
    }
  }, [selectedConversation]);

  // Handle sending a text message
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageText.trim() || !selectedUserId) return;
    
    try {
      setIsSending(true);
      const newMessage = await sendMessage(selectedUserId, { content: messageText.trim() });
      
      // Add to messages
      setSelectedConversation(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          messages: [newMessage, ...prev.messages],
        };
      });
      
      setMessageText('');
      
      // Refresh conversations list to update preview
      loadConversations();
    } catch (err) {
      console.error('Failed to send message:', err);
    } finally {
      setIsSending(false);
    }
  };

  // Handle back button (mobile)
  const handleBack = () => {
    setSelectedConversation(null);
    setSelectedUserId(null);
  };

  // Render conversation list item
  const renderConversationItem = (conv: ConversationSummary) => {
    const displayName = getDisplayName(conv.counterpartyName, conv.counterpartyEmail);
    const isSelected = selectedUserId === conv.counterpartyUserId;
    
    return (
      <button
        key={conv.counterpartyUserId}
        onClick={() => loadConversation(conv.counterpartyUserId)}
        className={`w-full px-4 py-3 flex items-start gap-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 
          transition-colors text-left ${isSelected ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}
      >
        {/* Avatar */}
        <div className="flex-shrink-0 w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 
          flex items-center justify-center text-white font-semibold text-lg">
          {displayName.charAt(0).toUpperCase()}
        </div>
        
        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <h3 className="font-medium text-gray-900 dark:text-white truncate">
              {displayName}
            </h3>
            <span className="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">
              {formatRelativeTime(conv.lastActivityAt)}
            </span>
          </div>
          
          <div className="flex items-center justify-between mt-0.5">
            <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
              {conv.lastMessagePreview || 'No messages yet'}
            </p>
            
            {conv.unreadCount > 0 && (
              <span className="flex-shrink-0 ml-2 px-2 py-0.5 text-xs font-medium text-white 
                bg-blue-600 rounded-full">
                {conv.unreadCount}
              </span>
            )}
          </div>
          
          {/* Net amount */}
          {(conv.totalSent || conv.totalReceived) && (
            <div className="flex items-center gap-2 mt-1 text-xs">
              {conv.totalSent ? (
                <span className="text-red-600 dark:text-red-400">
                  ↑ {formatChatCurrency(conv.totalSent, conv.primaryCurrency || 'INR')}
                </span>
              ) : null}
              {conv.totalReceived ? (
                <span className="text-green-600 dark:text-green-400">
                  ↓ {formatChatCurrency(conv.totalReceived, conv.primaryCurrency || 'INR')}
                </span>
              ) : null}
            </div>
          )}
        </div>
      </button>
    );
  };

  // Render a message bubble
  const renderMessage = (msg: ConversationMessage) => {
    const isFromMe = msg.isFromMe;
    
    if (msg.type === 'Transaction' && msg.transaction) {
      const tx = msg.transaction;
      const isSend = tx.transactionType === 'Send';
      
      return (
        <div
          key={msg.id}
          className={`flex ${isFromMe ? 'justify-end' : 'justify-start'} mb-3`}
        >
          <div className={`max-w-[75%] rounded-2xl px-4 py-3 ${
            isFromMe 
              ? 'bg-blue-600 text-white' 
              : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white'
          }`}>
            {/* Transaction badge */}
            <div className={`flex items-center gap-2 mb-2 text-sm ${
              isFromMe ? 'text-blue-100' : 'text-gray-500 dark:text-gray-400'
            }`}>
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                isSend 
                  ? 'bg-red-500/20 text-red-200' 
                  : 'bg-green-500/20 text-green-200'
              }`}>
                {isSend ? '↑ Sent' : '↓ Received'}
              </span>
              {tx.isPending && (
                <span className="px-2 py-0.5 rounded text-xs bg-yellow-500/20 text-yellow-200">
                  Pending
                </span>
              )}
            </div>
            
            {/* Amount */}
            <p className="text-2xl font-bold">
              {formatChatCurrency(tx.amount, tx.currency)}
            </p>
            
            {/* Title/note */}
            {tx.title && (
              <p className={`mt-1 text-sm ${isFromMe ? 'text-blue-100' : 'text-gray-600 dark:text-gray-300'}`}>
                {tx.title}
              </p>
            )}
            
            {/* Account */}
            {tx.accountName && (
              <p className={`mt-1 text-xs ${isFromMe ? 'text-blue-200' : 'text-gray-500 dark:text-gray-400'}`}>
                {tx.accountName}
              </p>
            )}
            
            {/* Time */}
            <p className={`mt-2 text-xs ${isFromMe ? 'text-blue-200' : 'text-gray-400 dark:text-gray-500'}`}>
              {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
        </div>
      );
    }
    
    // Text message
    return (
      <div
        key={msg.id}
        className={`flex ${isFromMe ? 'justify-end' : 'justify-start'} mb-3`}
      >
        <div className={`max-w-[75%] rounded-2xl px-4 py-2 ${
          isFromMe 
            ? 'bg-blue-600 text-white' 
            : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white'
        }`}>
          <p>{msg.content}</p>
          <p className={`mt-1 text-xs ${isFromMe ? 'text-blue-200' : 'text-gray-400 dark:text-gray-500'}`}>
            {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] bg-white dark:bg-gray-800">
      {/* Conversations List - hidden on mobile when a conversation is selected */}
      <div className={`w-full md:w-80 lg:w-96 border-r border-gray-200 dark:border-gray-700 
        flex flex-col ${selectedConversation ? 'hidden md:flex' : 'flex'}`}>
        {/* Header */}
        <div className="px-4 py-4 border-b border-gray-200 dark:border-gray-700">
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Chats</h1>
        </div>
        
        {/* Conversation list */}
        <div className="flex-1 overflow-y-auto">
          {conversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full p-8 text-center">
              <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <p className="text-gray-500 dark:text-gray-400">No conversations yet</p>
              <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
                Send money to someone to start a conversation
              </p>
            </div>
          ) : (
            conversations.map(renderConversationItem)
          )}
        </div>
      </div>
      
      {/* Conversation View - full screen on mobile when selected */}
      <div className={`flex-1 flex flex-col ${selectedConversation ? 'flex' : 'hidden md:flex'}`}>
        {selectedConversation ? (
          <>
            {/* Conversation Header */}
            <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center gap-3">
              {/* Back button (mobile) */}
              <button
                onClick={handleBack}
                className="md:hidden p-1 -ml-1 text-gray-600 dark:text-gray-300"
              >
                <ChevronLeftIcon />
              </button>
              
              {/* Avatar */}
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 
                flex items-center justify-center text-white font-semibold">
                {getDisplayName(selectedConversation.counterpartyName, selectedConversation.counterpartyEmail)
                  .charAt(0).toUpperCase()}
              </div>
              
              {/* Name & email */}
              <div className="flex-1 min-w-0">
                <h2 className="font-medium text-gray-900 dark:text-white truncate">
                  {getDisplayName(selectedConversation.counterpartyName, selectedConversation.counterpartyEmail)}
                </h2>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                  {selectedConversation.counterpartyEmail}
                </p>
              </div>
              
              {/* Totals */}
              <div className="hidden sm:flex items-center gap-4 text-sm">
                <div className="text-center">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Sent</p>
                  <p className="font-medium text-red-600 dark:text-red-400">
                    {formatChatCurrency(selectedConversation.totalSent, 'INR')}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Received</p>
                  <p className="font-medium text-green-600 dark:text-green-400">
                    {formatChatCurrency(selectedConversation.totalReceived, 'INR')}
                  </p>
                </div>
              </div>
            </div>
            
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 flex flex-col-reverse">
              <div ref={messagesEndRef} />
              {isLoadingMessages ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
                </div>
              ) : selectedConversation.messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <p className="text-gray-500 dark:text-gray-400">No messages yet</p>
                  <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
                    Send a message or money to start the conversation
                  </p>
                </div>
              ) : (
                <div className="space-y-1">
                  {/* Messages are in reverse order, so render from end */}
                  {[...selectedConversation.messages].reverse().map(renderMessage)}
                </div>
              )}
            </div>
            
            {/* Message Input */}
            <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700">
              <form onSubmit={handleSendMessage} className="flex items-center gap-2">
                {/* Send Money Button */}
                <button
                  type="button"
                  onClick={() => setShowSendMoney(true)}
                  className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 
                    rounded-full transition-colors"
                  title="Send Money"
                >
                  <CurrencyIcon />
                </button>
                
                {/* Text Input */}
                <input
                  ref={messageInputRef}
                  type="text"
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  placeholder="Type a message..."
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-full
                    bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                    focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                
                {/* Send Button */}
                <button
                  type="submit"
                  disabled={!messageText.trim() || isSending}
                  className="p-2 text-white bg-blue-600 hover:bg-blue-700 rounded-full 
                    disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <SendIcon />
                </button>
              </form>
            </div>
          </>
        ) : (
          /* Empty state when no conversation selected (desktop) */
          <div className="hidden md:flex flex-col items-center justify-center h-full text-center p-8">
            <div className="w-20 h-20 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center mb-4">
              <svg className="w-10 h-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <h2 className="text-xl font-medium text-gray-900 dark:text-white mb-2">
              Select a conversation
            </h2>
            <p className="text-gray-500 dark:text-gray-400">
              Choose a conversation from the list to view messages
            </p>
          </div>
        )}
      </div>

      {/* TODO: Send Money Modal */}
      {showSendMoney && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
              Send Money
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              Send money feature coming soon...
            </p>
            <button
              onClick={() => setShowSendMoney(false)}
              className="w-full px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 
                rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Error toast */}
      {error && (
        <div className="fixed bottom-4 right-4 px-4 py-2 bg-red-600 text-white rounded-lg shadow-lg">
          {error}
          <button onClick={() => setError(null)} className="ml-2">×</button>
        </div>
      )}
    </div>
  );
}
