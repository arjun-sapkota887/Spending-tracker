"use client";

import {
  Button,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Select,
  SelectItem,
  Tab,
  Tabs,
} from "@heroui/react";
import { useState } from "react";
import { INCOME, LOANS, SPENDING, type Category } from "@/lib/categories";
import { newTransaction, toDayString, type Transaction } from "@/lib/parse";

type Direction = "out" | "in";

const OPTIONS: Record<Direction, readonly Category[]> = {
  out: [...SPENDING, ...LOANS],
  in: [...INCOME, ...LOANS],
};

/**
 * For anything that isn't on a card statement, like cash tips, cash you lent a friend,
 * or soccer fees paid in cash.
 */
export function AddEntryModal({
  isOpen,
  onClose,
  onAdd,
  defaultDate,
}: {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (t: Transaction) => void;
  defaultDate: string;
}) {
  const [direction, setDirection] = useState<Direction>("in");
  const [date, setDate] = useState(defaultDate);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<Category>("Tips");

  const value = parseFloat(amount);
  const valid = date && description.trim() && value > 0;

  function submit() {
    if (!valid) return;
    onAdd(
      newTransaction({
        date,
        description: description.trim(),
        amount: direction === "out" ? -value : value,
        account: "Cash",
        category,
      }),
    );
    setDescription("");
    setAmount("");
    onClose();
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} placement="center">
      <ModalContent>
        <ModalHeader>Add an entry</ModalHeader>
        <ModalBody className="gap-4">
          <Tabs
            fullWidth
            selectedKey={direction}
            onSelectionChange={(k) => {
              const d = k as Direction;
              setDirection(d);
              setCategory(d === "in" ? "Tips" : "Groceries");
            }}
          >
            <Tab key="in" title="Money in" />
            <Tab key="out" title="Money out" />
          </Tabs>
          <Input
            label="Amount"
            type="number"
            min="0"
            step="0.01"
            startContent={<span className="text-small text-default-400">$</span>}
            value={amount}
            onValueChange={setAmount}
            autoFocus
          />
          <Input
            label="Description"
            placeholder={direction === "in" ? "Friday night tips" : "Lent to Sam for dinner"}
            value={description}
            onValueChange={setDescription}
          />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Date" type="date" value={date} onValueChange={setDate} max={toDayString(new Date())} />
            <Select
              label="Category"
              selectedKeys={[category]}
              disallowEmptySelection
              onSelectionChange={(keys) => setCategory([...keys][0] as Category)}
            >
              {OPTIONS[direction].map((c) => (
                <SelectItem key={c}>{c}</SelectItem>
              ))}
            </Select>
          </div>
          {LOANS.includes(category as (typeof LOANS)[number]) && (
            <p className="text-tiny text-default-500">
              {category === "Lent"
                ? direction === "out"
                  ? "Money you lent someone. It counts toward what you're owed."
                  : "Someone paying you back. It reduces what you're owed."
                : direction === "in"
                  ? "Money you borrowed. It counts toward what you owe."
                  : "You paying someone back. It reduces what you owe."}
            </p>
          )}
        </ModalBody>
        <ModalFooter>
          <Button variant="light" onPress={onClose}>
            Cancel
          </Button>
          <Button color="primary" isDisabled={!valid} onPress={submit}>
            Add
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
