

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../services/supabaseClient';
import { User, Settings, ChatMessage, Employee } from '../types';
// FIX: Import `MessageSquare` icon from `lucide-react` to fix 'Cannot find name' error.
import { Send, User as UserIcon, Search, CornerDownLeft, MessageSquare } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface TeamChatPageProps {
  currentUser: User | null;
  activeStoreId: string | null;
  settings: Settings;
  users: User[];
}

const TeamChatPage: React.FC<TeamChatPageProps> = ({ currentUser, activeStoreId, settings, users }) => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [activeChat, setActiveChat] = useState<Employee | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const chatBodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Filter out the owner/current user from the employee list
    if (currentUser) {
      setEmployees(settings.employees.filter(e => e.id !== currentUser.phone && e.status === 'active'));
    }
  }, [settings.employees, currentUser]);

  useEffect(() => {
    // Scroll to bottom when new messages arrive
    if (chatBodyRef.current) {
      chatBodyRef.current.scrollTop = chatBodyRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (!activeChat || !currentUser || !activeStoreId) {
      setMessages([]);
      return;
    }

    setLoading(true);

    const fetchMessages = async () => {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('store_id', activeStoreId)
        .or(`and(sender_id.eq.${currentUser.phone},receiver_id.eq.${activeChat.id}),and(sender_id.eq.${activeChat.id},receiver_id.eq.${currentUser.phone})`)
        .order('created_at', { ascending: true });
      
      if (error) {
        console.error('Error fetching messages:', error);
      } else {
        setMessages(data || []);
      }
      setLoading(false);
    };

    fetchMessages();

    const channel = supabase.channel(`team-chat:${activeStoreId}:${currentUser.phone}:${activeChat.id}`);
    const subscription = channel
      .on('postgres_changes', { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'chat_messages',
          filter: `store_id=eq.${activeStoreId}`
      }, 
      (payload) => {
          const newMessage = payload.new as ChatMessage;
          if ((newMessage.sender_id === currentUser.phone && newMessage.receiver_id === activeChat.id) || 
              (newMessage.sender_id === activeChat.id && newMessage.receiver_id === currentUser.phone)) {
              setMessages(prev => [...prev, newMessage]);
          }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeChat, currentUser, activeStoreId]);

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !activeChat || !currentUser || !activeStoreId) return;

    const content = newMessage;
    setNewMessage('');

    const { error } = await supabase
      .from('chat_messages')
      .insert({
          store_id: activeStoreId,
          sender_id: currentUser.phone,
          receiver_id: activeChat.id,
          content: content,
      });

    if (error) {
      console.error('Error sending message:', error);
      setNewMessage(content); // Re-add message to input if sending failed
    }
  };

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col">
      <div className="flex-1 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex overflow-hidden">
        {/* Conversations List */}
        <div className="w-1/3 border-l border-slate-200 dark:border-slate-800 flex flex-col h-full">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800">
            <h2 className="font-bold text-lg text-slate-800 dark:text-white">محادثات الموظفين</h2>
          </div>
          <div className="flex-1 overflow-y-auto">
            {employees.map(employee => (
              <button key={employee.id} onClick={() => setActiveChat(employee)} className={`w-full text-right p-4 flex items-center gap-3 transition-colors border-b border-slate-100 dark:border-slate-800 ${activeChat?.id === employee.id ? 'bg-indigo-50 dark:bg-indigo-900/30' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}>
                <div className="w-10 h-10 bg-slate-200 dark:bg-slate-700 rounded-full flex items-center justify-center font-bold text-slate-500 text-sm">
                  {employee.name.substring(0, 2)}
                </div>
                <div>
                  <h4 className="font-bold text-slate-800 dark:text-white text-sm">{employee.name}</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{employee.email}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Chat Window */}
        <div className="w-2/3 flex flex-col h-full">
          {activeChat ? (
            <>
              <div className="p-3 border-b border-slate-200 dark:border-slate-800 flex items-center gap-3 flex-shrink-0 bg-slate-50 dark:bg-slate-800/50">
                <div className="w-10 h-10 bg-slate-200 dark:bg-slate-700 rounded-full flex items-center justify-center font-bold text-slate-500 text-sm">{activeChat.name.substring(0, 2)}</div>
                <div>
                  <h3 className="font-bold text-slate-800 dark:text-white">{activeChat.name}</h3>
                  <p className="text-xs text-emerald-500">متصل</p>
                </div>
              </div>

              <div ref={chatBodyRef} className="flex-1 p-6 space-y-4 overflow-y-auto bg-slate-100/50 dark:bg-slate-950">
                {loading ? <p>جاري تحميل الرسائل...</p> : messages.map(msg => (
                  <div key={msg.id} className={`flex items-end gap-2 ${msg.sender_id === currentUser?.phone ? 'justify-end' : 'justify-start'}`}>
                    {msg.sender_id !== currentUser?.phone && <div className="w-8 h-8 bg-slate-200 dark:bg-slate-700 rounded-full flex items-center justify-center text-slate-500 flex-shrink-0"><UserIcon size={16}/></div>}
                    <div className={`max-w-[70%] p-3 rounded-2xl text-sm ${msg.sender_id === currentUser?.phone ? 'bg-indigo-600 text-white rounded-br-none' : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-white rounded-bl-none shadow-sm'}`}>
                      {msg.content}
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex-shrink-0">
                <div className="relative">
                  <textarea
                    placeholder="اكتب رسالتك..."
                    className="w-full bg-slate-100 dark:bg-slate-800 border-transparent rounded-lg p-3 pr-4 pl-12 text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
                    rows={1}
                    value={newMessage}
                    onChange={e => setNewMessage(e.target.value)}
                    onKeyPress={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSendMessage())}
                  />
                  <button onClick={handleSendMessage} className="absolute left-2 top-1/2 -translate-y-1/2 p-2 bg-indigo-600 text-white rounded-lg disabled:bg-slate-400" disabled={!newMessage.trim()}>
                    <Send size={16} />
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-center text-slate-400 p-8">
              <div>
                <MessageSquare size={48} className="mx-auto mb-4" />
                <h3 className="font-bold text-lg text-slate-700 dark:text-slate-300">حدد محادثة للبدء</h3>
                <p className="text-sm mt-2">اختر موظفاً من القائمة على اليمين لعرض المحادثة.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TeamChatPage;