using System.Collections.Concurrent;

namespace DigiTransac.Api.Services;

/// <summary>
/// Tracks which users are online via their SignalR connections.
/// A user is considered online if they have at least one active connection
/// (they may have multiple tabs/devices).
/// </summary>
public interface IPresenceTracker
{
    /// <summary>
    /// Register a new connection for a user.
    /// Returns true if this is the user's first connection (they just came online).
    /// </summary>
    bool UserConnected(string userId, string connectionId);

    /// <summary>
    /// Remove a connection for a user.
    /// Returns true if this was the user's last connection (they just went offline).
    /// </summary>
    bool UserDisconnected(string userId, string connectionId);

    /// <summary>
    /// Check if a specific user is currently online.
    /// </summary>
    bool IsOnline(string userId);

    /// <summary>
    /// Get the set of online user IDs from a given list.
    /// </summary>
    HashSet<string> GetOnlineUsers(IEnumerable<string> userIds);
}

public class InMemoryPresenceTracker : IPresenceTracker
{
    private readonly ConcurrentDictionary<string, HashSet<string>> _onlineUsers = new();
    private readonly object _lock = new();

    public bool UserConnected(string userId, string connectionId)
    {
        lock (_lock)
        {
            if (_onlineUsers.TryGetValue(userId, out var connections))
            {
                connections.Add(connectionId);
                return false; // Already had connections — not a new online event
            }

            _onlineUsers[userId] = [connectionId];
            return true; // First connection — user just came online
        }
    }

    public bool UserDisconnected(string userId, string connectionId)
    {
        lock (_lock)
        {
            if (!_onlineUsers.TryGetValue(userId, out var connections))
                return false;

            connections.Remove(connectionId);

            if (connections.Count == 0)
            {
                _onlineUsers.TryRemove(userId, out _);
                return true; // Last connection removed — user went offline
            }

            return false;
        }
    }

    public bool IsOnline(string userId)
    {
        return _onlineUsers.ContainsKey(userId);
    }

    public HashSet<string> GetOnlineUsers(IEnumerable<string> userIds)
    {
        var result = new HashSet<string>();
        foreach (var userId in userIds)
        {
            if (_onlineUsers.ContainsKey(userId))
                result.Add(userId);
        }
        return result;
    }
}
