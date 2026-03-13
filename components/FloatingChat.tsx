import React, { useState, useRef, useEffect, useMemo } from 'react';
import { MessageSquare, X, Send, User, Users, ChevronLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { User as UserType, ChatMessage } from '../types';
import { supabase } from '../services/supabaseClient';

interface FloatingChatProps {
    currentUser: UserType | null;
    storeOwner: UserType | null;
    activeStoreId: string | null;
}

export interface FloatingChatHandles {
    toggle: () => void;
}

const FloatingChat = React.forwardRef<FloatingChatHandles, FloatingChatProps>(({ currentUser, storeOwner, activeStoreId }, ref) => {
    const [isOpen, setIsOpen] = useState(false);
    const [activeChat, setActiveChat] = useState<{ id: string, name: string, icon: React.ReactElement } | null>(null);
    const [message, setMessage] = useState('');
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const chatBodyRef = useRef<HTMLDivElement>(null);

    const contacts = useMemo(() => {
        const c: { id: string, name: string, icon: React.ReactElement }[] = [];
        if (storeOwner) {
            c.push({ id: storeOwner.phone, name: 'المدير', icon: <User size={20} /> });
        }
        // Future: c.push({ id: 'team', name: 'فريق العمل', icon: <Users size={20} /> });
        return c;
    }, [storeOwner]);

    React.useImperativeHandle(ref, () => ({
        toggle: () => setIsOpen(p => !p)
    }));

    useEffect(() => {
        if (chatBodyRef.current) {
            chatBodyRef.current.scrollTop = chatBodyRef.current.scrollHeight;
        }
    }, [messages]);

    useEffect(() => {
        if (!activeChat || !currentUser || !activeStoreId) {
            setMessages([]);
            return;
        };

        const fetchMessages = async () => {
            const { data, error } = await supabase
                .from('chat_messages')
                .select('*')
                .eq('store_id', activeStoreId)
                .or(`and(sender_id.eq.${currentUser.phone},receiver_id.eq.${activeChat.id}),and(sender_id.eq.${activeChat.id},receiver_id.eq.${currentUser.phone})`)
                .order('created_at', { ascending: true });
            
            if (error) {
                console.error('Error fetching chat messages:', error);
            } else {
                setMessages(data || []);
            }
        };

        fetchMessages();

        const channel = supabase.channel(`chat:${activeStoreId}:${currentUser.phone}:${activeChat.id}`);
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
        if (!message.trim() || !activeChat || !currentUser || !activeStoreId) return;

        const content = message;
        setMessage('');

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
            setMessage(content); // Re-add message to input if sending failed
        }
    };

    return (
        <>
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 50, scale: 0.9 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 50, scale: 0.9 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                        className="fixed bottom-6 left-6 z-50 w-80 h-[450px] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden"
                    >
                        <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between flex-shrink-0">
                            <div className="flex items-center gap-2">
                                {activeChat && (
                                    <button onClick={() => setActiveChat(null)} className="p-1 text-slate-500 hover:text-slate-800"><ChevronLeft size={20}/></button>
                                )}
                                <h3 className="font-bold text-slate-800 dark:text-white">
                                    {activeChat ? activeChat.name : 'دردشة الفريق'}
                                </h3>
                            </div>
                            <button onClick={() => setIsOpen(false)} className="p-1 text-slate-500 hover:text-red-500"><X size={20}/></button>
                        </div>
                        
                        {!activeChat ? (
                            <div className="flex-1 p-2">
                                {contacts.map(contact => (
                                    <button key={contact.id} onClick={() => setActiveChat(contact)} className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                                        <div className="p-2 bg-slate-200 dark:bg-slate-700 rounded-full text-slate-600 dark:text-slate-300">{contact.icon}</div>
                                        <span className="font-bold text-slate-700 dark:text-slate-200">{contact.name}</span>
                                    </button>
                                ))}
                            </div>
                        ) : (
                            <>
                                <div ref={chatBodyRef} className="flex-1 p-4 space-y-4 overflow-y-auto">
                                    {messages.map(msg => (
                                        <div key={msg.id} className={`flex items-end gap-2 ${msg.sender_id === currentUser?.phone ? 'justify-end' : 'justify-start'}`}>
                                            {msg.sender_id !== currentUser?.phone && <div className="w-8 h-8 bg-slate-200 dark:bg-slate-700 rounded-full flex items-center justify-center text-slate-500 flex-shrink-0">{activeChat.icon}</div>}
                                            <div className={`max-w-[80%] p-3 rounded-2xl text-sm animate-in fade-in-5 slide-in-from-bottom-2 duration-300 ${msg.sender_id === currentUser?.phone ? 'bg-indigo-600 text-white rounded-br-none' : 'bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-white rounded-bl-none'}`}>
                                                {msg.content}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <div className="p-3 border-t border-slate-200 dark:border-slate-800 flex items-center gap-2 flex-shrink-0">
                                    <input 
                                        type="text" 
                                        placeholder="اكتب رسالتك..."
                                        className="flex-1 bg-slate-100 dark:bg-slate-800 border-transparent rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                        value={message}
                                        onChange={e => setMessage(e.target.value)}
                                        onKeyPress={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSendMessage())}
                                    />
                                    <button onClick={handleSendMessage} className="p-2 bg-indigo-600 text-white rounded-lg disabled:bg-slate-400" disabled={!message.trim()}>
                                        <Send size={18} />
                                    </button>
                                </div>
                            </>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
});

export default FloatingChat;