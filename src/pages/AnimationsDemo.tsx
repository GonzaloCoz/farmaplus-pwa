import { AnimatedButton } from '@/components/ui/AnimatedButton';
import { AnimatedCard } from '@/components/ui/AnimatedCard';
import { StaggerContainer } from '@/components/ui/StaggerContainer';
import { Skeleton, SkeletonCard, SkeletonTable, SkeletonChart, SkeletonWidget } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PageLayout } from '@/components/layout/PageLayout';
import { useState } from 'react';

export default function AnimationsDemo() {
    const [showSkeletons, setShowSkeletons] = useState(false);

    return (
        <PageLayout>
            <div className="space-y-8 p-6">
                <div>
                    <h1 className="text-3xl font-bold mb-2">Animations Demo</h1>
                    <p className="text-muted-foreground">
                        Demostración de los nuevos componentes de animación
                    </p>
                </div>

                {/* Animated Buttons */}
                <section className="space-y-4">
                    <h2 className="text-2xl font-semibold">Animated Buttons</h2>
                    <div className="flex flex-wrap gap-4">
                        <AnimatedButton variant="subtle">
                            <Button>Subtle Animation</Button>
                        </AnimatedButton>
                        <AnimatedButton variant="prominent">
                            <Button variant="default">Prominent Animation</Button>
                        </AnimatedButton>
                        <AnimatedButton variant="none">
                            <Button variant="outline">No Animation</Button>
                        </AnimatedButton>
                    </div>
                </section>

                {/* Animated Cards */}
                <section className="space-y-4">
                    <h2 className="text-2xl font-semibold">Animated Cards</h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <AnimatedCard hoverEffect="lift">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Lift Effect</CardTitle>
                                    <CardDescription>Hover para ver el efecto</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <p>Esta card se eleva al hacer hover</p>
                                </CardContent>
                            </Card>
                        </AnimatedCard>

                        <AnimatedCard hoverEffect="glow">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Glow Effect</CardTitle>
                                    <CardDescription>Hover para ver el efecto</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <p>Esta card brilla al hacer hover</p>
                                </CardContent>
                            </Card>
                        </AnimatedCard>

                        <AnimatedCard hoverEffect="scale">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Scale Effect</CardTitle>
                                    <CardDescription>Hover para ver el efecto</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <p>Esta card escala al hacer hover</p>
                                </CardContent>
                            </Card>
                        </AnimatedCard>
                    </div>
                </section>

                {/* Stagger Container */}
                <section className="space-y-4">
                    <h2 className="text-2xl font-semibold">Stagger Animation</h2>
                    <StaggerContainer className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        {[1, 2, 3, 4].map((i) => (
                            <Card key={i}>
                                <CardHeader>
                                    <CardTitle>Item {i}</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <p>Animación escalonada</p>
                                </CardContent>
                            </Card>
                        ))}
                    </StaggerContainer>
                </section>

                {/* Skeletons */}
                <section className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-2xl font-semibold">Skeleton Loaders</h2>
                        <Button onClick={() => setShowSkeletons(!showSkeletons)}>
                            {showSkeletons ? 'Mostrar Contenido' : 'Mostrar Skeletons'}
                        </Button>
                    </div>

                    {showSkeletons ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <SkeletonCard />
                            <SkeletonWidget />
                            <div className="md:col-span-2">
                                <SkeletonTable />
                            </div>
                            <div className="md:col-span-2">
                                <SkeletonChart />
                            </div>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Contenido Real</CardTitle>
                                    <CardDescription>Este es el contenido cargado</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <p>Los skeletons se muestran mientras carga el contenido</p>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardHeader>
                                    <CardTitle>Widget Real</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-3xl font-bold">1,234</div>
                                    <p className="text-sm text-muted-foreground">Métrica importante</p>
                                </CardContent>
                            </Card>
                        </div>
                    )}
                </section>

                {/* Tailwind Animations */}
                <section className="space-y-4">
                    <h2 className="text-2xl font-semibold">Tailwind Custom Animations</h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Card className="animate-fade-in">
                            <CardHeader>
                                <CardTitle>Fade In</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p>animate-fade-in</p>
                            </CardContent>
                        </Card>

                        <Card className="animate-slide-up">
                            <CardHeader>
                                <CardTitle>Slide Up</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p>animate-slide-up</p>
                            </CardContent>
                        </Card>

                        <Card className="animate-scale-in">
                            <CardHeader>
                                <CardTitle>Scale In</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p>animate-scale-in</p>
                            </CardContent>
                        </Card>
                    </div>
                </section>
            </div>
        </PageLayout>
    );
}
