import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Lock, User } from 'lucide-react';
import { useDataStore } from '@/store/dataStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';

export default function Login() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const login = useDataStore((state) => state.login);
  
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!username || !password) {
      toast({
        title: 'Validation Error',
        description: 'Please fill in all fields',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const success = login(username, password);
    
    if (success) {
      toast({
        title: 'Login Successful',
        description: 'Welcome to LogiBid Control Panel',
      });
      navigate('/dashboard/home');
    } else {
      toast({
        title: 'Login Failed',
        description: 'Invalid credentials. Try admin/admin123',
        variant: 'destructive',
      });
    }
    
    setIsLoading(false);
  };

  const handleForgotPassword = () => {
    toast({
      title: 'Forgot Password',
      description: 'Please contact your administrator to reset your password.',
    });
  };

  return (
    <div className="min-h-screen gradient-bg flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-card rounded-xl shadow-2xl p-8 animate-fade-in">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
            <Shield className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Vendor Login</h1>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Username */}
          <div className="space-y-2">
            <Label htmlFor="username" className="text-foreground font-medium">
              Username
            </Label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter username"
                className="pl-10 bg-card border-border"
                required
              />
            </div>
          </div>

          {/* Password */}
          <div className="space-y-2">
            <Label htmlFor="password" className="text-foreground font-medium">
              Password
            </Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                className="pl-10 bg-card border-border"
                required
              />
            </div>
          </div>

          {/* Forgot Password */}
          <div className="text-right">
            <button
              type="button"
              onClick={handleForgotPassword}
              className="text-sm text-primary hover:text-primary/80 hover:underline transition-colors"
            >
              Forgot Password?
            </button>
          </div>

          {/* Submit Button */}
          <Button
            type="submit"
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-medium py-3"
            disabled={isLoading}
          >
            {isLoading ? 'Logging in...' : 'Login'}
          </Button>
        </form>

        {/* Demo credentials hint */}
        <div className="mt-6 p-3 bg-muted/50 rounded-lg border border-border">
          <p className="text-xs text-muted-foreground text-center">
            <strong>Demo Credentials:</strong><br />
            <span className="text-primary">Vendor:</span> <code className="text-foreground">vendor</code> / <code className="text-foreground">vendor123</code><br />
            <span className="text-blue-400">Fleet:</span> <code className="text-foreground">fleet</code> / <code className="text-foreground">fleet123</code>
          </p>
        </div>

        {/* Fleet Admin Login Link */}
        <div className="mt-4 text-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/admin/login')}
            className="text-muted-foreground hover:text-foreground"
          >
            Fleet Admin Login →
          </Button>
        </div>
      </div>
    </div>
  );
}
