import type { APIRoute } from 'astro';
import { getTeamBoard } from '../../../lib/nfl/board';

export const GET: APIRoute = async () => {
  try {
    const board = await getTeamBoard();
    return new Response(JSON.stringify(board), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to build team board';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
