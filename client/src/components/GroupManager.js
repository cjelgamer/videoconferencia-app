import React, { useState } from 'react';

const GroupManager = ({ roomId, socket, groups, currentUserId, pdfActive, linkedGroupId }) => {
    const [isCreating, setIsCreating] = useState(false);
    const [newGroupName, setNewGroupName] = useState("");
    const [showGroups, setShowGroups] = useState(false);

    const createGroup = () => {
        if (!newGroupName.trim()) return;
        socket.emit("create-group", {
            roomId,
            groupName: newGroupName,
            permissions: {
                canDraw: true,
                canNavigate: true
            }
        });
        setNewGroupName("");
        setIsCreating(false);
    };

    const deleteGroup = (groupId) => {
        if (window.confirm("¿Eliminar grupo?")) {
            socket.emit("delete-group", { roomId, groupId });
        }
    };

    const linkPdf = (groupId) => {
        socket.emit("link-pdf-group", { roomId, groupId });
    };

    const joinGroup = (groupId) => {
        socket.emit("add-group-member", { roomId, groupId, userId: currentUserId });
    };

    const leaveGroup = (groupId) => {
        socket.emit("remove-group-member", { roomId, groupId, userId: currentUserId });
    };

    if (!showGroups) {
        return (
            <button
                onClick={() => setShowGroups(true)}
                className="btn"
                style={{ padding: "8px 16px", fontSize: "0.9rem", marginLeft: "10px" }}
            >
                👥 Grupos
            </button>
        );
    }

    return (
        <div style={{
            position: 'absolute',
            top: '60px',
            right: '20px',
            background: '#2a2a2a',
            padding: '15px',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
            zIndex: 1000,
            width: '300px',
            maxHeight: '400px',
            overflowY: 'auto',
            border: '1px solid #444'
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                <h3 style={{ margin: 0, color: 'white' }}>Grupos de Presentación</h3>
                <button onClick={() => setShowGroups(false)} style={{ background: 'none', border: 'none', color: '#aaa', cursor: 'pointer' }}>✕</button>
            </div>

            <div style={{ marginBottom: '15px' }}>
                {!isCreating ? (
                    <button
                        onClick={() => setIsCreating(true)}
                        style={{ width: '100%', padding: '8px', background: '#3b82f6', border: 'none', borderRadius: '4px', color: 'white', cursor: 'pointer' }}
                    >
                        + Crear Grupo
                    </button>
                ) : (
                    <div style={{ display: 'flex', gap: '5px' }}>
                        <input
                            value={newGroupName}
                            onChange={(e) => setNewGroupName(e.target.value)}
                            placeholder="Nombre del grupo"
                            style={{ flex: 1, padding: '5px', borderRadius: '4px', border: '1px solid #555', background: '#333', color: 'white' }}
                        />
                        <button onClick={createGroup} style={{ background: '#10b981', border: 'none', borderRadius: '4px', color: 'white', padding: '0 10px' }}>✓</button>
                        <button onClick={() => setIsCreating(false)} style={{ background: '#ef4444', border: 'none', borderRadius: '4px', color: 'white', padding: '0 10px' }}>✕</button>
                    </div>
                )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {groups && groups.map(group => {
                    const isMember = group.members.includes(currentUserId);
                    const isLinked = linkedGroupId === group._id;

                    return (
                        <div key={group._id} style={{ background: '#333', padding: '10px', borderRadius: '6px', border: isLinked ? '1px solid #10b981' : '1px solid #444' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
                                <span style={{ fontWeight: 'bold', color: 'white' }}>{group.name}</span>
                                <button onClick={() => deleteGroup(group._id)} style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }}>🗑</button>
                            </div>

                            <div style={{ fontSize: '0.8rem', color: '#aaa', marginBottom: '8px' }}>
                                {group.members.length} miembros
                                {isMember && <span style={{ color: '#10b981', marginLeft: '5px' }}>(Tú estás aquí)</span>}
                            </div>

                            <div style={{ display: 'flex', gap: '5px' }}>
                                {isMember ? (
                                    <button onClick={() => leaveGroup(group._id)} style={{ flex: 1, padding: '4px', fontSize: '0.8rem', background: '#ef4444', border: 'none', borderRadius: '4px', color: 'white', cursor: 'pointer' }}>Salir</button>
                                ) : (
                                    <button onClick={() => joinGroup(group._id)} style={{ flex: 1, padding: '4px', fontSize: '0.8rem', background: '#3b82f6', border: 'none', borderRadius: '4px', color: 'white', cursor: 'pointer' }}>Unirse</button>
                                )}

                                {pdfActive && (
                                    <button
                                        onClick={() => linkPdf(group._id)}
                                        disabled={isLinked}
                                        style={{ flex: 1, padding: '4px', fontSize: '0.8rem', background: isLinked ? '#10b981' : '#f59e0b', border: 'none', borderRadius: '4px', color: 'white', cursor: 'pointer', opacity: isLinked ? 0.7 : 1 }}
                                    >
                                        {isLinked ? 'Vinculado' : 'Vincular PDF'}
                                    </button>
                                )}
                            </div>
                        </div>
                    );
                })}
                {groups && groups.length === 0 && (
                    <div style={{ textAlign: 'center', color: '#666', fontSize: '0.9rem' }}>No hay grupos creados</div>
                )}
            </div>
        </div>
    );
};

export default GroupManager;
