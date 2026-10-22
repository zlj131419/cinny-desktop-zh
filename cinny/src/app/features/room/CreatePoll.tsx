import React, { useState } from 'react';
import {
  Box,
  Button,
  Dialog,
  Icon,
  IconButton,
  Icons,
  Input,
  Overlay,
  OverlayBackdrop,
  OverlayCenter,
  Text,
  toRem,
} from 'folds';

/**
 * 发起投票弹窗（MSC3381）：问题 + 2~10 个选项，单选、公开计票，
 * 与 Element 互通。发送逻辑在 RoomInput 里组装 m.poll.start 事件。
 */

const MIN_OPTIONS = 2;
const MAX_OPTIONS = 10;

type CreatePollProps = {
  open: boolean;
  onClose: () => void;
  onCreate: (question: string, options: string[]) => void;
};

export function CreatePoll({ open, onClose, onCreate }: CreatePollProps) {
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState<string[]>(['', '']);

  const trimmedOptions = options.map((o) => o.trim()).filter((o) => o.length > 0);
  const canCreate = question.trim().length > 0 && trimmedOptions.length >= MIN_OPTIONS;

  const reset = () => {
    setQuestion('');
    setOptions(['', '']);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleCreate = () => {
    if (!canCreate) return;
    onCreate(question.trim(), trimmedOptions);
    reset();
  };

  return (
    <Overlay open={open} backdrop={<OverlayBackdrop />}>
      <OverlayCenter>
        <Dialog variant="Surface" style={{ width: toRem(420), maxWidth: '92vw' }}>
          <Box direction="Column" gap="300" style={{ padding: toRem(16) }}>
            <Text size="H4">发起投票</Text>
            <Box direction="Column" gap="100">
              <Text size="L300">问题</Text>
              <Input
                variant="SurfaceVariant"
                size="400"
                radii="300"
                placeholder="问大家一个问题"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                maxLength={200}
              />
            </Box>
            <Box direction="Column" gap="200">
              <Text size="L300">选项</Text>
              {options.map((opt, i) => (
                <Box key={i} gap="200" alignItems="Center">
                  <Box grow="Yes">
                    <Input
                      variant="SurfaceVariant"
                      size="400"
                      radii="300"
                      placeholder={`选项 ${i + 1}`}
                      value={opt}
                      maxLength={100}
                      onChange={(e) => {
                        const next = [...options];
                        next[i] = e.target.value;
                        setOptions(next);
                      }}
                    />
                  </Box>
                  {options.length > MIN_OPTIONS && (
                    <IconButton
                      variant="SurfaceVariant"
                      size="300"
                      radii="300"
                      onClick={() => setOptions(options.filter((_, j) => j !== i))}
                      aria-label="删除选项"
                    >
                      <Icon src={Icons.Cross} size="50" />
                    </IconButton>
                  )}
                </Box>
              ))}
              {options.length < MAX_OPTIONS && (
                <Button
                  variant="Secondary"
                  fill="Soft"
                  radii="300"
                  size="300"
                  onClick={() => setOptions([...options, ''])}
                >
                  添加选项
                </Button>
              )}
            </Box>
            <Box gap="200" justifyContent="End">
              <Button variant="Secondary" fill="Soft" radii="300" onClick={handleClose}>
                取消
              </Button>
              <Button variant="Primary" radii="300" onClick={handleCreate} disabled={!canCreate}>
                发起投票
              </Button>
            </Box>
          </Box>
        </Dialog>
      </OverlayCenter>
    </Overlay>
  );
}
