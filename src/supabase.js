import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseKey)

// Регистрация
export async function signUp(email, password, username) {
  const { data, error } = await supabase.auth.signUp({ email, password })
  if (error) return { error }

  // Создаём запись в таблице players
  const { error: dbError } = await supabase.from('players').insert({
    id: data.user.id,
    name: username,
    email: email,
  })
  if (dbError) return { error: dbError }

  return { user: data.user }
}

// Логин
export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) return { error }

  // Загружаем баланс из БД
  const { data: player } = await supabase
    .from('players')
    .select('*')
    .eq('id', data.user.id)
    .single()

  return { user: data.user, player }
}

// Сохранить баланс
export async function saveBalance(userId, bal, rounds, wins, pnl, name) {
  await supabase.from('players').update({ bal, rounds, wins }).eq('id', userId)
  if (rounds > 0) {
    await supabase.from('leaderboard').upsert({
      player_id: userId,
      name: name || 'Player',
      bal, rounds, wins,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'player_id' })
  }
}

// Сохранить раунд в историю
export async function saveRound(userId, round) {
  await supabase.from('round_history').insert({
    player_id:   userId,
    title:       round.title,
    outcome:     round.t,
    my_choice:   round.my,
    their_choice: round.them,
    stake:       round.stake,
    delta:       round.d,
    rake:        round.rake || 0,
  })
}

// Загрузить историю раундов
export async function loadRounds(userId) {
  const { data } = await supabase
    .from('round_history')
    .select('*')
    .eq('player_id', userId)
    .order('created_at', { ascending: false })
    .limit(20)
  return data || []
}

// Текущий юзер — восстанавливает сессию при перезагрузке
export async function getCurrentUser() {
  const { data } = await supabase.auth.getSession()
  if (!data.session) return null
  const user = data.session.user

  // Загружаем данные игрока
  const { data: player } = await supabase
    .from('players')
    .select('*')
    .eq('id', user.id)
    .single()

  return { user, player }
}