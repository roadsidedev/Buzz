# Component Usage Guide

Complete examples for using all Neobrutalism design system components.

---

## Button Component

### Variants

```typescript
import { Button } from "@/components";

export function ButtonDemo() {
  return (
    <div className="space-y-4">
      {/* Primary: Black background */}
      <Button variant="primary">Primary Button</Button>

      {/* Secondary: White background */}
      <Button variant="secondary">Secondary Button</Button>

      {/* Accent: Cyan background */}
      <Button variant="accent">Accent Button</Button>
    </div>
  );
}
```

### Sizes

```typescript
<div className="space-y-4">
  <Button size="sm">Small</Button>
  <Button size="md">Medium</Button>
  <Button size="lg">Large</Button>
</div>
```

### States

```typescript
<div className="space-y-4">
  {/* Default */}
  <Button variant="primary">Default</Button>

  {/* Loading */}
  <Button variant="primary" isLoading>
    Submitting...
  </Button>

  {/* Disabled */}
  <Button variant="primary" disabled>
    Disabled
  </Button>

  {/* With onClick handler */}
  <Button variant="accent" onClick={() => alert("Clicked!")}>
    Click Me
  </Button>
</div>
```

### Full Example

```typescript
import { useState } from "react";
import { Button } from "@/components";

export function SignupForm() {
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async () => {
    setIsLoading(true);
    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 2000));
      alert("Submitted!");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={(e) => e.preventDefault()}>
      <h2 className="text-2xl font-bold mb-4">Sign Up</h2>
      <Button
        variant="accent"
        size="lg"
        isLoading={isLoading}
        onClick={handleSubmit}
      >
        {isLoading ? "Creating Account..." : "Sign Up"}
      </Button>
    </form>
  );
}
```

---

## Card Component

### Variants

```typescript
import { Card } from "@/components";

export function CardDemo() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {/* Default: White background with border */}
      <Card variant="default" padding="md">
        <h3>Default Card</h3>
        <p>Content here</p>
      </Card>

      {/* Bordered: Transparent with border only */}
      <Card variant="bordered" padding="md">
        <h3>Bordered Card</h3>
        <p>Content here</p>
      </Card>

      {/* Flat: Gray background */}
      <Card variant="flat" padding="md">
        <h3>Flat Card</h3>
        <p>Content here</p>
      </Card>
    </div>
  );
}
```

### Padding Options

```typescript
<div className="space-y-4">
  <Card padding="sm">
    <p>Small padding (12px)</p>
  </Card>

  <Card padding="md">
    <p>Medium padding (24px)</p>
  </Card>

  <Card padding="lg">
    <p>Large padding (32px)</p>
  </Card>
</div>
```

### Clickable Card

```typescript
import { useNavigate } from "react-router-dom";

export function PodcastCard() {
  const navigate = useNavigate();

  return (
    <Card
      isClickable
      onClick={() => navigate("/podcast/123")}
      padding="lg"
    >
      <h3 className="text-xl font-bold mb-2">Amazing Podcast</h3>
      <p className="text-base-gray-600">Hosted by Agent Smith</p>
      <p className="text-sm text-base-gray-500 mt-2">234 listeners</p>
    </Card>
  );
}
```

---

## Badge Component

### Variants

```typescript
import { Badge } from "@/components";

export function BadgeDemo() {
  return (
    <div className="space-y-3">
      <Badge variant="default">Default</Badge>
      <Badge variant="primary">Primary</Badge>
      <Badge variant="secondary">Secondary</Badge>
      <Badge variant="success">Success</Badge>
      <Badge variant="warning">Warning</Badge>
      <Badge variant="error">Error</Badge>
    </div>
  );
}
```

### Live Indicator

```typescript
<div className="space-y-3">
  {/* Pulsing red badge for live streams */}
  <Badge variant="error" isLive>
    🔴 LIVE
  </Badge>

  {/* Status badges */}
  <Badge variant="success">✓ Ready</Badge>
  <Badge variant="warning">⟳ Processing</Badge>
  <Badge variant="primary">📊 Trending</Badge>
</div>
```

### Status Display

```typescript
export function EpisodeStatus({ status }: { status: string }) {
  const variantMap: Record<string, BadgeVariant> = {
    draft: "default",
    generating: "warning",
    ready: "success",
    failed: "error",
  };

  return (
    <div className="flex items-center gap-2">
      <Badge variant={variantMap[status]}>
        {status.toUpperCase()}
      </Badge>
      <span className="text-sm text-base-gray-500">
        {status === "ready" && "Ready to listen"}
        {status === "generating" && "Creating audio..."}
        {status === "failed" && "Something went wrong"}
      </span>
    </div>
  );
}
```

---

## Input Component

### Basic Usage

```typescript
import { Input } from "@/components";
import { useState } from "react";

export function SearchForm() {
  const [query, setQuery] = useState("");

  return (
    <form>
      <Input
        type="text"
        label="Search Podcasts"
        placeholder="Enter search term..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <Button className="mt-4">Search</Button>
    </form>
  );
}
```

### Email & Password

```typescript
export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    const newErrors: Record<string, string> = {};

    if (!email) newErrors.email = "Email is required";
    if (!email.includes("@")) newErrors.email = "Invalid email format";

    if (!password) newErrors.password = "Password is required";
    if (password.length < 8) newErrors.password = "Password must be 8+ chars";

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    // Submit to API
    console.log("Submitting:", { email, password });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h2 className="text-2xl font-bold">Login</h2>

      <Input
        type="email"
        label="Email Address"
        placeholder="you@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        error={errors.email}
        required
      />

      <Input
        type="password"
        label="Password"
        placeholder="••••••••"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        error={errors.password}
        helperText="Min 8 characters"
        required
      />

      <Button variant="accent" type="submit">
        Sign In
      </Button>
    </form>
  );
}
```

### Number & Search

```typescript
<div className="space-y-4">
  {/* Number input */}
  <Input
    type="number"
    label="Price"
    placeholder="0.00"
    min="0"
    step="0.01"
  />

  {/* Search input */}
  <Input
    type="search"
    label="Search"
    placeholder="Type to search..."
  />
</div>
```

---

## Textarea Component

### Basic Usage

```typescript
import { Textarea } from "@/components";
import { useState } from "react";

export function FeedbackForm() {
  const [message, setMessage] = useState("");

  return (
    <form className="space-y-4">
      <Textarea
        label="Your Feedback"
        placeholder="Tell us what you think..."
        value={message}
        onChange={(e) => setMessage(e.target.value)}
      />
      <Button variant="accent">Submit</Button>
    </form>
  );
}
```

### With Character Count

```typescript
<Textarea
  label="Bio"
  placeholder="Write a short bio..."
  maxLength={500}
  showCharCount
  helperText="Keep it under 500 characters"
/>
```

### Multi-line with Validation

```typescript
export function CreateRoomForm() {
  const [objective, setObjective] = useState("");
  const [error, setError] = useState("");

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setObjective(value);

    // Clear error on change
    if (error) setError("");

    // Validation
    if (value.length < 10) {
      setError("Objective must be at least 10 characters");
    } else if (value.length > 500) {
      setError("Objective must be less than 500 characters");
    }
  };

  return (
    <form className="space-y-4">
      <h2 className="text-2xl font-bold">Create Room</h2>

      <Textarea
        label="Room Objective"
        placeholder="What should the room accomplish?"
        value={objective}
        onChange={handleChange}
        error={error}
        maxLength={500}
        showCharCount
        required
      />

      <Button
        variant="accent"
        disabled={!objective || !!error}
      >
        Create Room
      </Button>
    </form>
  );
}
```

---

## Combining Components

### Episode Card

```typescript
import { Card, Badge, Button } from "@/components";

interface EpisodeCardProps {
  title: string;
  status: "draft" | "generating" | "ready" | "failed";
  listenCount: number;
  onPlay: () => void;
}

export function EpisodeCard({
  title,
  status,
  listenCount,
  onPlay,
}: EpisodeCardProps) {
  const statusVariant: Record<string, any> = {
    draft: "default",
    generating: "warning",
    ready: "success",
    failed: "error",
  };

  return (
    <Card padding="lg">
      <div className="flex items-start justify-between mb-3">
        <h3 className="text-lg font-bold flex-1">{title}</h3>
        <Badge variant={statusVariant[status]}>
          {status.toUpperCase()}
        </Badge>
      </div>

      <p className="text-sm text-base-gray-600 mb-4">
        {listenCount} listener{listenCount !== 1 ? "s" : ""}
      </p>

      {status === "ready" && (
        <Button
          variant="primary"
          size="sm"
          onClick={onPlay}
        >
          ▶ Play
        </Button>
      )}

      {status === "generating" && (
        <p className="text-sm text-base-gray-500">
          Creating audio... please wait
        </p>
      )}

      {status === "failed" && (
        <p className="text-sm text-error font-semibold">
          Failed to generate audio
        </p>
      )}
    </Card>
  );
}
```

### Login Card

```typescript
export function LoginCard() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async () => {
    setIsLoading(true);
    try {
      // API call
      await login(email, password);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card variant="default" padding="lg" className="max-w-md">
      <h2 className="text-2xl font-bold mb-6">Login</h2>

      <Input
        type="email"
        label="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="mb-4"
      />

      <Input
        type="password"
        label="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="mb-6"
      />

      <Button
        variant="accent"
        fullWidth
        isLoading={isLoading}
        onClick={handleLogin}
      >
        {isLoading ? "Signing in..." : "Sign In"}
      </Button>

      <p className="text-sm text-base-gray-600 text-center mt-4">
        Don't have an account?{" "}
        <a href="/signup" className="font-bold text-primary-500">
          Sign up
        </a>
      </p>
    </Card>
  );
}
```

---

## Styling Patterns

### Layout with Cards

```typescript
export function Dashboard() {
  return (
    <div className="container max-w-5xl mx-auto p-8">
      {/* Header */}
      <h1 className="text-5xl font-bold uppercase mb-12">Dashboard</h1>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i} padding="lg">
            <h3 className="text-xl font-bold mb-2">Card {i + 1}</h3>
            <p className="text-base-gray-600">Content here</p>
          </Card>
        ))}
      </div>

      {/* Footer */}
      <div className="mt-12 border-t-2 border-base-black pt-8">
        <p className="text-center text-base-gray-500">
          © 2026 ClawHouse. All rights reserved.
        </p>
      </div>
    </div>
  );
}
```

### Form Layout

```typescript
export function PodcastForm() {
  return (
    <Card variant="default" padding="lg" className="max-w-2xl">
      <h2 className="text-3xl font-bold mb-8">Create Podcast</h2>

      <form className="space-y-6">
        <Input
          type="text"
          label="Podcast Title"
          placeholder="Enter title..."
          required
        />

        <Textarea
          label="Description"
          placeholder="Describe your podcast..."
          maxLength={500}
          showCharCount
        />

        <div>
          <label className="block text-sm font-bold uppercase mb-2">
            Category
          </label>
          <select className="input-field w-full">
            <option>Technology</option>
            <option>Finance</option>
            <option>Creative</option>
            <option>Other</option>
          </select>
        </div>

        <div className="flex gap-4 pt-4">
          <Button variant="secondary" className="flex-1">
            Cancel
          </Button>
          <Button variant="accent" className="flex-1">
            Create Podcast
          </Button>
        </div>
      </form>
    </Card>
  );
}
```

---

## Accessibility Best Practices

### Keyboard Navigation

```typescript
<Button
  variant="primary"
  onClick={() => {
    // This component is keyboard accessible by default
  }}
>
  Keyboard Accessible
</Button>
```

All components support:
- Tab navigation
- Enter/Space activation
- Escape to close/cancel
- ARIA attributes

### Error Handling

```typescript
<Input
  label="Email"
  error="Please enter a valid email address"
  aria-invalid={!!error}
  aria-describedby="email-error"
/>
```

### Screen Reader Support

```typescript
<Badge variant="error" role="status" aria-live="polite">
  Error message for screen readers
</Badge>
```

---

## Real-world Examples

### Live Room Card

```typescript
export function LiveRoomCard({
  objective,
  type,
  hostName,
  listenerCount,
  duration,
}: LiveRoomProps) {
  return (
    <Card isClickable padding="lg">
      <div className="flex justify-between items-start mb-3">
        <h3 className="text-lg font-bold">{objective}</h3>
        <Badge variant="error" isLive>
          🔴 LIVE
        </Badge>
      </div>

      <div className="space-y-2 text-sm">
        <p className="text-base-gray-600">
          Type: <span className="font-semibold">{type}</span>
        </p>
        <p className="text-base-gray-600">
          Host: <span className="font-semibold">{hostName}</span>
        </p>
        <p className="text-base-gray-600">
          {listenerCount} listener{listenerCount !== 1 ? "s" : ""} •{" "}
          <span className="font-mono">{duration}</span>
        </p>
      </div>

      <Button variant="primary" className="mt-4 w-full">
        Join Room
      </Button>
    </Card>
  );
}
```

---

**For more examples, check DESIGN_SYSTEM.md and explore the component source files.**
