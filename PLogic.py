import itertools
from typing import List, Dict, Set
from pprint import pprint

import numpy as np
import pandas as pd


def precedence(op: str) -> int:
    return {"~": 5, "&": 4, "^": 3, "|": 2, "-": 1, "=": 0}.get(op, -1)


def infix_to_postfix(expression: str) -> List[str]:
    output = []
    operators = []
    current_str = ""

    for char in expression:
        if char.isalpha():
            current_str += char
        else:
            if current_str:
                output.append(current_str)
                current_str = ""

            if char in ["~", "&", "^", "|", "-", "="]:
                while operators and precedence(operators[-1]) >= precedence(char):
                    output.append(operators.pop())
                operators.append(char)
            elif char == "(":
                operators.append(char)
            elif char == ")":
                while operators and operators[-1] != "(":
                    output.append(operators.pop())
                if not operators:
                    raise ValueError("Unbalanced parentheses")
                operators.pop()
            else:
                raise Exception(f"Invalid expression: {expression}, Nuh uh")

    if current_str:
        output.append(current_str)

    while operators:
        if operators[-1] == "(":
            raise ValueError("Unbalanced parentheses")
        output.append(operators.pop())

    return output


class PExp:
    def __init__(self, expression: str) -> None:
        self._expression: str = expression.replace(" ", "")
        self._post_expression: List[str] = infix_to_postfix(self._expression)
        self._key_elements: Dict[str, np.ndarray] = self._build_table()
        self._num_var: int

    def vars(self) -> Set[str]:
        return {s for s in self.post_expression if any(c.isalnum() for c in s)}

    def _build_table(self) -> Dict[str, np.ndarray]:
        rizz: Dict[str, np.ndarray] = {}
        variables = self.vars()
        self._num_var = len(variables)
        for i, var in enumerate(sorted(list(variables)), start=1):
            j = 1 << i
            rizz.update({var: np.array(self._build_col(j))})
        return rizz

    def _build_col(self, j: int) -> List[bool]:
        return list(
            itertools.chain.from_iterable(
                [[True] * (2**self._num_var // j) + [False] * (2**self._num_var // j)]
                * (j // 2)
            )
        )

    @property
    def expression(self) -> str:
        return self._expression

    @property
    def post_expression(self) -> List[str]:
        return self._post_expression

    @property
    def key_elements(self) -> Dict[str, List[bool]]:
        rizz = dict(
            zip(
                self._key_elements.keys(),
                [arr.tolist() for arr in self._key_elements.values()],
            )
        )
        return rizz

    def apply_op(self, elem: str, lift: str, right: str) -> np.ndarray:
        if elem == "&":
            rizz = self._key_elements[lift] & self._key_elements[right]
        elif elem == "|":
            rizz = self._key_elements[lift] | self._key_elements[right]
        elif elem == "^":
            rizz = self._key_elements[lift] ^ self._key_elements[right]
        elif elem == "=":
            rizz = self._key_elements[lift] == self._key_elements[right]
        elif elem == "-":
            rizz = ~self._key_elements[lift] | self._key_elements[right]
        else:
            raise Exception(f"Invalid expression: {self._expression}, Nuh uh")
        return rizz

    def solve(self) -> "PExp":
        solve_stack: List[str] = []
        for elem in self._post_expression:
            if elem in self._key_elements:
                solve_stack.append(elem)
                continue

            right: str = solve_stack.pop()

            if elem == "~":
                value = ~self._key_elements[right]
                key: str = f"~{right}"
            else:
                lift: str = solve_stack.pop()
                key = f"{lift}{elem}{right}"
                value = self.apply_op(elem, lift, right)

            self._key_elements.update({key: value})
            solve_stack.append(key)

        if not solve_stack:
            raise Exception(f"Invalid expression: {self._expression}, Nuh uh")

        self._df = self._to_pandas()
        return self

    def show(self) -> "PExp":
        pprint(self._key_elements)
        return self

    def show_table(self) -> "PExp":
        print(self._df.to_markdown(), "\n")
        return self

    def final_answer(self) -> np.ndarray:
        return list(self._key_elements.items())[-1][1]

    def _to_pandas(self) -> pd.DataFrame:
        return pd.DataFrame(self._key_elements)

    @property
    def df(self) -> pd.DataFrame:
        return self._df.astype("int8")

    def where(self, **kwargs) -> pd.DataFrame:
        con: np.ndarray = np.ones(2**self._num_var, dtype=bool)

        for k, v in kwargs.items():
            con &= self._key_elements[k] == v

        return self._df[con].astype("int8")

    def __eq__(self, other) -> bool:
        try:
            return all(self.final_answer() == other.final_answer())
        except ValueError:
            return False


if __name__ == "__main__":
    exp0 = PExp("b").solve().show_table()
    e0 = PExp("a").solve().show_table()
    exp1 = PExp("q").solve().show_table()
    # print(exp0.where(b=1, c=0).to_markdown(), '\n')
    # print(PExp("p|k").solve().where(x=1, c=0, b=1, a=1, p=0, k=1).to_markdown())
    print(exp0 == exp1)
