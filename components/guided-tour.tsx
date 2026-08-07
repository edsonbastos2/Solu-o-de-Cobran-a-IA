'use client';

import { useCallback, useEffect, useRef } from 'react';
import { driver, type DriveStep, type Driver } from 'driver.js';
import { usePathname } from 'next/navigation';

const MAX_AUTO_ACCESSES = 5;
const TOUR_VERSION = 'v1';

type GuidedTourProps = {
  userId: string | null;
  loading: boolean;
  isConfigured: boolean;
};

const getStorageKey = (prefix: string, userKey: string) =>
  `cobrancaia:tour:${TOUR_VERSION}:${prefix}:${userKey}`;

function getTourSteps(pathname: string | null): DriveStep[] {
  const agentsMenuTarget = typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches
    ? '[data-tour="agents-nav-desktop"]'
    : '[data-tour="mobile-menu-trigger"]';
  const policiesMenuTarget = typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches
    ? '[data-tour="policies-nav-desktop"]'
    : '[data-tour="mobile-menu-trigger"]';

  const steps: DriveStep[] = [
    {
      element: '[data-tour="app-logo"]',
      popover: {
        title: 'Bem-vindo à CobrançaIA',
        description: 'Este é o ponto de acesso rápido ao seu dashboard e à visão geral da operação.',
      },
    },
    {
      element: agentsMenuTarget,
      popover: {
        title: 'Agentes IA',
        description: 'No menu Agentes IA você configura os especialistas, o Supervisor IA e a orquestração inteligente das cobranças.',
      },
    },
    {
      element: policiesMenuTarget,
      popover: {
        title: 'Políticas de cobrança',
        description: 'No menu Políticas você define as regras padrão da empresa, como juros, multas, negativação e protesto.',
      },
    },
    {
      element: '[data-tour="header-settings"]',
      popover: {
        title: 'Seu perfil e configurações',
        description: 'Acesse seu perfil, integrações de mensagens e configurações dos provedores de IA por aqui.',
      },
    },
    {
      element: '[data-tour="guided-tour-trigger"]',
      popover: {
        title: 'Ajuda quando você precisar',
        description: 'Use este botão para reabrir o tour a qualquer momento, mesmo depois dos cinco primeiros acessos.',
      },
    },
    {
      element: '[data-tour="help-chat"]',
      popover: {
        title: 'Assistente da plataforma',
        description: 'O assistente virtual pode responder dúvidas sobre como usar a plataforma.',
      },
    },
  ];

  if (pathname === '/') {
    steps.splice(1, 0,
      {
        element: '[data-tour="dashboard-cases"]',
        popover: {
          title: 'Casos de cobrança',
          description: 'Acompanhe negociações e conversas em tempo real com seus devedores.',
        },
      },
      {
        element: '[data-tour="dashboard-contracts"]',
        popover: {
          title: 'Contratos',
          description: 'Cadastre contratos e extraia informações importantes usando IA.',
        },
      },
      {
        element: '[data-tour="dashboard-clients"]',
        popover: {
          title: 'Clientes',
          description: 'Consulte e gerencie os clientes relacionados à sua operação de cobrança.',
        },
      },
    );
  }

  if (pathname === '/agents') {
    steps.splice(2, 0,
      {
        element: '[data-tour="agents-engine"]',
        popover: {
          title: 'Multi-Agent Orchestration Engine',
          description: 'Aqui você cria e configura agentes especializados. O Supervisor IA coordena cada especialista conforme o contexto da cobrança.',
        },
      },
      {
        element: '[data-tour="agents-topology"]',
        popover: {
          title: 'Topologia do Sistema de Agentes',
          description: 'Este diagrama mostra o Orquestrador Central distribuindo o trabalho entre os especialistas de Cobrança, Negociação, Financeiro, Jurídico, Qualidade e Crédito.',
        },
      },
    );
  }

  if (pathname === '/policies') {
    steps.splice(3, 0, {
      element: '[data-tour="policies-module"]',
      popover: {
        title: 'Configuração das políticas',
        description: 'Gerencie as regras que orientam a cobrança e crie novas políticas para diferentes cenários da sua empresa.',
      },
    });
  }

  return steps;
}

export function GuidedTour({ userId, loading, isConfigured }: GuidedTourProps) {
  const pathname = usePathname();
  const driverRef = useRef<Driver | null>(null);
  const userKey = userId || (!isConfigured ? 'demo' : null);

  const startTour = useCallback(() => {
    if (!userKey) return;

    driverRef.current?.destroy();

    const tour = driver({
      animate: true,
      allowClose: true,
      allowKeyboardControl: true,
      overlayClickBehavior: 'close',
      overlayOpacity: 0.7,
      smoothScroll: true,
      stagePadding: 8,
      stageRadius: 12,
      skipMissingElement: true,
      waitForElement: 350,
      showProgress: true,
      progressText: '{{current}} de {{total}}',
      nextBtnText: 'Próximo',
      prevBtnText: 'Anterior',
      doneBtnText: 'Concluir',
      popoverClass: 'cobrancaia-tour',
      steps: getTourSteps(pathname),
    });

    driverRef.current = tour;
    tour.drive();
  }, [pathname, userKey]);

  useEffect(() => {
    if (!userKey || pathname === '/login' || loading || (isConfigured && !userId)) return;

    const handleStart = () => startTour();
    window.addEventListener('cobrancaia:start-tour', handleStart);

    return () => {
      window.removeEventListener('cobrancaia:start-tour', handleStart);
    };
  }, [isConfigured, loading, pathname, startTour, userId, userKey]);

  useEffect(() => {
    if (!userKey || pathname === '/login' || loading || (isConfigured && !userId)) return;

    const sessionKey = getStorageKey('session-counted', userKey);
    const accessKey = getStorageKey('access-count', userKey);
    let accessNumber = 0;

    try {
      if (window.sessionStorage.getItem(sessionKey)) return;

      window.sessionStorage.setItem(sessionKey, '1');
      const storedAccesses = Number(window.localStorage.getItem(accessKey) || '0');
      if (Number.isFinite(storedAccesses) && storedAccesses >= MAX_AUTO_ACCESSES) return;

      accessNumber = Number.isFinite(storedAccesses) ? storedAccesses + 1 : 1;
      window.localStorage.setItem(accessKey, String(accessNumber));
    } catch {
      // Storage can be disabled by the browser; the tour remains available manually.
      return;
    }

    if (accessNumber > MAX_AUTO_ACCESSES) return;

    const timeoutId = window.setTimeout(() => startTour(), 450);
    return () => {
      window.clearTimeout(timeoutId);
      driverRef.current?.destroy();
      driverRef.current = null;
    };
  }, [isConfigured, loading, pathname, startTour, userId, userKey]);

  useEffect(() => {
    return () => {
      driverRef.current?.destroy();
      driverRef.current = null;
    };
  }, [pathname]);

  return null;
}
