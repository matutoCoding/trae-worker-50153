import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Home,
  Calendar,
  Clock,
  Users,
  BarChart3,
  ChevronDown,
  Music,
} from 'lucide-react';
import { useAppStore } from '@/stores/useAppStore';
import { api } from '@/lib/api';

const navItems = [
  { path: '/', label: '首页', icon: Home },
  { path: '/schedule', label: '排期', icon: Calendar },
  { path: '/bookings', label: '我的预约', icon: Clock },
  { path: '/family', label: '家庭', icon: Users },
  { path: '/statistics', label: '统计', icon: BarChart3 },
];

const mockUsers = [
  { userId: 'user-1', name: '李爸爸', familyId: 'family-1', role: 'owner' as const, avatar: '👨' },
  { userId: 'user-2', name: '李小明', familyId: 'family-1', role: 'member' as const, avatar: '👦' },
  { userId: 'user-3', name: '李小红', familyId: 'family-1', role: 'member' as const, avatar: '👧' },
];

export default function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const { user, setUser, setFamilyInfo, setMyBookings } = useAppStore();

  const handleSwitchUser = async (mockUser: typeof mockUsers[number]) => {
    try {
      await api.login(mockUser.userId);
      setUser(mockUser);
      setDropdownOpen(false);
      const [family, bookings] = await Promise.all([
        api.getFamilyInfo(),
        api.getMyBookings(),
      ]);
      setFamilyInfo(family);
      setMyBookings(bookings);
      navigate('/');
    } catch (e) {
      console.error('切换用户失败', e);
    }
  };

  const currentUser = user || mockUsers[0];

  return (
    <nav className="bg-white border-b border-gray-100 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-emerald-900 to-emerald-700 flex items-center justify-center">
              <Music className="w-5 h-5 text-amber-200" />
            </div>
            <span className="font-serif text-xl font-bold text-emerald-900">琴韵</span>
          </Link>

          <div className="hidden md:flex items-center gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-emerald-50 text-emerald-900'
                      : 'text-gray-600 hover:text-emerald-900 hover:bg-gray-50'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {item.label}
                </Link>
              );
            })}
          </div>

          <div className="relative">
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-2 p-1 pr-2 rounded-full hover:bg-gray-100 transition-colors"
            >
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-white text-xs font-bold">
                {currentUser.avatar}
              </div>
              <span className="text-sm font-medium text-gray-700">{currentUser.name}</span>
              <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {dropdownOpen && (
              <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-lg border border-gray-100 py-2 z-50">
                <div className="px-4 py-2 border-b border-gray-50">
                  <p className="text-xs text-gray-500">切换用户</p>
                </div>
                {mockUsers.map((u) => (
                  <button
                    key={u.userId}
                    onClick={() => handleSwitchUser(u)}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                      currentUser.userId === u.userId
                        ? 'bg-emerald-50 text-emerald-900'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-white text-xs font-bold">
                      {u.avatar}
                    </div>
                    <div className="text-left">
                      <p className="font-medium">{u.name}</p>
                      <p className="text-xs text-gray-500">{u.role === 'owner' ? '家庭管理员' : '家庭成员'}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="md:hidden flex items-center gap-1 pb-3 overflow-x-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                  isActive
                    ? 'bg-emerald-50 text-emerald-900'
                    : 'text-gray-600 hover:text-emerald-900 hover:bg-gray-50'
                }`}
              >
                <Icon className="w-4 h-4" />
                {item.label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
