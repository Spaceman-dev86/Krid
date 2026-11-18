'use client'

import { createContext, useContext, type ReactNode } from 'react'

import { ShellNavProgress } from '@/src/components/shell/ShellNavProgress'
import type { ChatInboxItem } from '@/src/lib/chat/chat'
import type { NewChatClient, NewChatGroup } from './NewChatModal'

type ChatWorkspaceData = {
  inbox: ChatInboxItem[]
  clients: NewChatClient[]
  groups: NewChatGroup[]
  activeThreadId: string | null
  switchPending: boolean
  bootPending: boolean
  markThreadReadLocal: (threadId: string) => void
  refreshInbox: () => void
}

const ChatWorkspaceContext = createContext<ChatWorkspaceData | null>(null)

export function ChatWorkspaceProvider({
  value,
  children,
}: {
  value: ChatWorkspaceData
  children: ReactNode
}) {
  return <ChatWorkspaceContext.Provider value={value}>{children}</ChatWorkspaceContext.Provider>
}

export function useChatWorkspace(): ChatWorkspaceData {
  const ctx = useContext(ChatWorkspaceContext)
  if (!ctx) {
    return {
      inbox: [],
      clients: [],
      groups: [],
      activeThreadId: null,
      switchPending: false,
      bootPending: false,
      markThreadReadLocal: () => {},
      refreshInbox: () => {},
    }
  }
  return ctx
}

/** Barre fine sous le titre de conversation pendant un switch de fil. */
export function ChatThreadSwitchProgress() {
  const { switchPending } = useChatWorkspace()
  return <ShellNavProgress pending={switchPending} edge="bottom" />
}
